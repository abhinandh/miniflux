/* AUTO GENERATED FILE, DO NOT MODIFY THIS FILE, USE 'make js' */
var Miniflux = {};

var DEBUG = false;

Miniflux.App = (function() {

    return {
        Log: function(message) {
            if (DEBUG) {
               console.log(message);
            }
        },
        Run: function() {
            Miniflux.Event.ListenKeyboardEvents();
            Miniflux.Event.ListenMouseEvents();
            Miniflux.Event.ListenVisibilityEvents();
            Miniflux.Event.ListenTouchEvents();
            this.FrontendUpdateCheck();
        },
        FrontendUpdateCheck: function() {
            var request = new XMLHttpRequest();
            request.onload = function() {
                var response = JSON.parse(this.responseText);

                if (response['frontend_updatecheck_interval'] > 0) {
                    Miniflux.App.Log('Frontend updatecheck interval in minutes: ' + response['frontend_updatecheck_interval']);
                    Miniflux.Item.CheckForUpdates();
                    setInterval(function(){ Miniflux.Item.CheckForUpdates(); }, response['frontend_updatecheck_interval']*60*1000);
                }
                else {
                    Miniflux.App.Log('Frontend updatecheck disabled');
                }
            };

            request.open("POST", "?action=get-config", true);
            request.send(JSON.stringify(['frontend_updatecheck_interval']));
        }
    };

})();
Miniflux.Feed = (function() {

    // List of feeds currently updating
    var queue = [];

    // Number of concurrent requests when updating all feeds
    var queue_length = 5;

    return {
        Update: function(feed, callback) {
            var itemsCounter = feed.querySelector("span.items-count");
            if (! itemsCounter) return;

            var feed_id = feed.getAttribute("data-feed-id");

            var heading = feed.querySelector("h2:first-of-type");
            heading.className = "loading-icon";

            var request = new XMLHttpRequest();
            request.onload = function() {
                heading.className = "";
                feed.removeAttribute("data-feed-error");

                var lastChecked = feed.querySelector(".feed-last-checked");
                if (lastChecked) lastChecked.innerHTML = lastChecked.getAttribute("data-after-update");

                var response = JSON.parse(this.responseText);
                if (response['result']) {
                    itemsCounter.innerHTML = response['items_count']['items_unread'] + "/" + response['items_count']['items_total'];
                } else {
                    feed.setAttribute("data-feed-error", "1");
                }

                if (callback) {
                    callback(response);
                }
                else {
                    Miniflux.Item.CheckForUpdates();
                }
            };

            request.open("POST", "?action=refresh-feed&feed_id=" + feed_id, true);
            request.send();
        },
        UpdateAll: function(nb_concurrent_requests) {
            var feeds = Array.prototype.slice.call(document.querySelectorAll("article:not([data-feed-disabled])"));

            // Check if a custom amount of concurrent requests was defined
            if (nb_concurrent_requests) {
                queue_length = nb_concurrent_requests;
            }

            var interval = setInterval(function() {
                while (feeds.length > 0 && queue.length < queue_length) {
                    var feed = feeds.shift();
                    queue.push(parseInt(feed.getAttribute('data-feed-id'), 10));

                    Miniflux.Feed.Update(feed, function(response) {
                        var index = queue.indexOf(response['feed_id']);
                        if (index >= 0) queue.splice(index, 1);

                        if (feeds.length === 0 && queue.length === 0) {
                            clearInterval(interval);
                            Miniflux.Item.CheckForUpdates();
                        }
                    });
                }
            }, 100);
        }
    };
})();
Miniflux.Item = (function() {

    // timestamp of the latest item per feed ever seen
    var latest_feeds_items = [];

    // indicator for new unread items
    var unreadItems = false;

    var nbUnreadItems = function() {
        var navCounterElement = document.getElementById("nav-counter");

        if (navCounterElement) {
            return parseInt(navCounterElement.textContent, 10) || 0;
        }
    }();

    var nbPageItems = function() {
        var pageCounterElement = document.getElementById("page-counter");

        if (pageCounterElement) {
            return parseInt(pageCounterElement.textContent, 10) || 0;
        }
    }();

    function simulateMouseClick(element)
    {
        var event = document.createEvent("MouseEvents");
        event.initEvent("mousedown", true, true);
        element.dispatchEvent(event);

        event = document.createEvent("MouseEvents");
        event.initEvent("mouseup", true, true);
        element.dispatchEvent(event);

        element.click();
    }

    function getItemID(item)
    {
        return item.getAttribute("data-item-id");
    }

    function changeLabel(links)
    {
        if (links.length === 0) {
            return;
        }

        for (var i = 0; i < links.length; i++) {
            var link = links[i];

            if (link.hasAttribute("data-reverse-label")) {
                var content = link.innerHTML;
                link.innerHTML = link.getAttribute("data-reverse-label");
                link.setAttribute("data-reverse-label", content);
            }

            if (link.hasAttribute("data-reverse-title")) {
                var title = link.getAttribute("title");
                link.setAttribute("title", link.getAttribute("data-reverse-title"));
                link.setAttribute("data-reverse-title", title);
            }
        }
    }

    function changeAction(links, action)
    {
        if (links.length === 0) {
            return;
        }

        for (var i = 0; i < links.length; i++) {
            links[i].setAttribute("data-action", action);
        }
    }

    function changeBookmarkLabel(item)
    {
        var links = item.querySelectorAll(".bookmark-icon, a.bookmark");
        changeLabel(links);
    }

    function changeStatusLabel(item)
    {
        var links = item.querySelectorAll(".read-icon, a.mark");
        changeLabel(links);
    }

    function showItemAsRead(item)
    {
        if (item.getAttribute("data-item-status") === 'read') {
            return;
        }

        nbUnreadItems--;

        if (item.getAttribute("data-hide")) {
            hideItem(item);
            return;
        }

        item.setAttribute("data-item-status", "read");
        changeStatusLabel(item);

        var links = item.querySelectorAll(".read-icon, a.mark");
        changeAction(links, "mark-unread");
    }

    function showItemAsUnread(item)
    {
        if (item.getAttribute("data-item-status") === 'unread') {
            return;
        }

        nbUnreadItems++;

        if (item.getAttribute("data-hide")) {
            hideItem(item);
            return;
        }

        item.setAttribute("data-item-status", "unread");
        changeStatusLabel(item);

        var links = item.querySelectorAll(".read-icon, a.mark");
        changeAction(links, "mark-read");
    }

    function hideItem(item)
    {
        if (Miniflux.Event.lastEventType !== "mouse") {
            var items = document.getElementsByTagName("article");

            if (items[items.length-1].id === "current-item") {
                Miniflux.Nav.SelectPreviousItem();
            }
            else {
                Miniflux.Nav.SelectNextItem();
            }
        }

        item.parentNode.removeChild(item);
        nbPageItems--;
    }

    function updateCounters()
    {
        var pageHeading = null;

        // redirect to unread if we're on a nothing to read page
        if (window.location.href.indexOf('nothing_to_read=1') > -1 && nbUnreadItems > 0) {
            window.location.href = '?action=unread';
        } // reload to get a nothing to read page
        else if (nbPageItems  === 0) {
            window.location.reload();
        }

        var pageCounterElement = document.getElementById("page-counter");
        if (pageCounterElement) pageCounterElement.textContent = nbPageItems || '';

        var navCounterElement = document.getElementById("nav-counter");
        navCounterElement.textContent = nbUnreadItems || '';

        var pageHeadingElement = document.querySelector("div.page-header h2:first-of-type");
        if (pageHeadingElement) {
            pageHeading = pageHeadingElement.firstChild.nodeValue;
        }
        else {
            // special handling while viewing an article.
            // 1. The article does not have a page-header element
            // 2. An article could be opened from any page and has the original
            // page as data-item-page value
            var itemHeading = document.querySelector("article.item h1:first-of-type");
            if (itemHeading) {
                document.title = itemHeading.textContent;
                return;
            }
        }

        // pagetitle depends on current page
        var sectionElement = document.querySelector("section.page");
        switch (sectionElement.getAttribute("data-item-page")) {
            case "unread":
                document.title = "Miniflux (" + nbUnreadItems + ")";
                break;
            case "feed-items":
                document.title = "(" + nbPageItems + ") " + pageHeading;
                break;
            default:
                if (pageCounterElement) {
                    document.title = pageHeading + " (" + nbPageItems + ")";
                }
                else {
                    document.title = pageHeading;
                }
                break;
        }
    }

    function markAsRead(item)
    {
        var item_id = getItemID(item);
        var request = new XMLHttpRequest();

        request.onload = function() {
            if (Miniflux.Nav.IsListing()) {
                showItemAsRead(item);
                updateCounters();
            }
        };
        request.open("POST", "?action=mark-item-read&id=" + item_id, true);
        request.send();
    }

    function markAsUnread(item)
    {
        var item_id = getItemID(item);
        var request = new XMLHttpRequest();

        request.onload = function() {
            if (Miniflux.Nav.IsListing()) {
                showItemAsUnread(item);
                updateCounters();
            }
        };
        request.open("POST", "?action=mark-item-unread&id=" + item_id, true);
        request.send();
    }

    function markAsRemoved(item)
    {
        var item_id = getItemID(item);
        var request = new XMLHttpRequest();

        request.onload = function() {
            if (Miniflux.Nav.IsListing()) {
                hideItem(item);

                if (item.getAttribute("data-item-status") === "unread") nbUnreadItems--;
                updateCounters();
            }
        };
        request.open("POST", "?action=mark-item-removed&id=" + item_id, true);
        request.send();
    }

    return {
        MarkAsRead: markAsRead,
        MarkAsUnread: markAsUnread,
        MarkAsRemoved: markAsRemoved,
        SwitchBookmark: function(item) {
            var item_id = getItemID(item);
            var value = item.getAttribute("data-item-bookmark") === "1" ? "0" : "1";
            var request = new XMLHttpRequest();

            request.onload = function() {
                var sectionElement = document.querySelector("section.page");

                if (Miniflux.Nav.IsListing() && sectionElement.getAttribute("data-item-page") === "bookmarks") {
                    hideItem(item);
                    updateCounters();
                } else {
                    item.setAttribute("data-item-bookmark", value);
                    changeBookmarkLabel(item);
                }
            };

            request.open("POST", "?action=bookmark&id=" + item_id + "&value=" + value, true);
            request.send();
        },
        SwitchStatus: function(item) {
            var status = item.getAttribute("data-item-status");

            if (status === "read") {
                markAsUnread(item);
            }
            else if (status === "unread") {
                markAsRead(item);
            }
        },
        Show: function(item) {
            var link = item.querySelector("a.show");
            if (link) simulateMouseClick(link);
        },
        OpenOriginal: function(item) {
            var link = item.querySelector("a.original");
            if (link) simulateMouseClick(link)
        },
        DownloadContent: function(item) {
            var container = document.getElementById("download-item");
            if (! container) return;

            container.innerHTML = " " + container.getAttribute("data-before-message");
            container.className = "loading-icon";

            var request = new XMLHttpRequest();
            request.onload = function() {

                var response = JSON.parse(request.responseText);
                container.className = "";

                if (response['result']) {
                    var content = document.getElementById("item-content");
                    if (content) content.innerHTML = response['content'];

                    container.innerHTML = container.getAttribute("data-after-message");
                }
                else {
                    container.innerHTML = container.getAttribute("data-failure-message");
                }
            };

            var item_id = getItemID(item);
            request.open("POST", "?action=download-item&id=" + item_id, true);
            request.send();
        },
        MarkFeedAsRead: function(feed_id) {
            var request = new XMLHttpRequest();

            request.onload = function() {
                var articles = document.getElementsByTagName("article");

                for (var i = 0, ilen = articles.length; i < ilen; i++) {
                    showItemAsRead(articles[i]);
                }

                nbUnreadItems = this.responseText;
                updateCounters();
            };

            request.open("POST", "?action=mark-feed-as-read&feed_id=" + feed_id, true);
            request.send();
        },
        ToggleRTLMode: function() {
            var tags = [
                "#current-item h1",
                "#item-content",
                "#listing #current-item h2",
                "#listing #current-item .preview",
                "#listing #current-item .preview-full-content"
            ];

            for (var i = 0; i < tags.length; i++) {
                var tag = document.querySelector(tags[i]);

                if (tag) {
                    tag.dir = tag.dir == "" ? "rtl" : "";
                }
            }
        },
        hasNewUnread: function() {
            return unreadItems;
        },
        CheckForUpdates: function() {
           if (document.hidden && unreadItems) {
                Miniflux.App.Log('We already have updates, no need to check again');
                return;
            }

            var request = new XMLHttpRequest();
            request.onload = function() {
                var first_run = (latest_feeds_items.length === 0);
                var current_unread = false;
                var response = JSON.parse(this.responseText);

                for (var feed_id in response['feeds']) {
                    var current_feed = response['feeds'][feed_id];

                    if (! latest_feeds_items.hasOwnProperty(feed_id) || current_feed.time > latest_feeds_items[feed_id]) {
                        Miniflux.App.Log('feed ' + feed_id + ': New item(s)');
                        latest_feeds_items[feed_id] = current_feed.time;

                        if (current_feed.status === 'unread') {
                            Miniflux.App.Log('feed ' + feed_id + ': New unread item(s)');
                            current_unread = true;
                        }
                    }
                }

                Miniflux.App.Log('first_run: ' + first_run + ', current_unread: ' + current_unread + ', response.nbUnread: ' + response['nbUnread'] + ', nbUnreadItems: ' + nbUnreadItems);

                if (! document.hidden && (response['nbUnread'] !== nbUnreadItems || unreadItems)) {
                    Miniflux.App.Log('Counter changed! Updating unread counter.');
                    unreadItems = false;
                    nbUnreadItems = response['nbUnread'];
                    updateCounters();
                }
                else if (document.hidden && ! first_run && current_unread) {
                    Miniflux.App.Log('New Unread! Updating pagetitle.');
                    unreadItems = true;
                    document.title = "↻ " + document.title;
                }
                else {
                    Miniflux.App.Log('No update.');
                }

                Miniflux.App.Log('unreadItems: ' + unreadItems);
            };

            request.open("POST", "?action=latest-feeds-items", true);
            request.send();
        }
    };

})();
Miniflux.Event = (function() {

    var queue = [];

    function isEventIgnored(e)
    {
        if (e.keyCode !== 63 && e.which !== 63 && (e.ctrlKey || e.shiftKey || e.altKey || e.metaKey)) {
            return true;
        }

        // Do not handle events when there is a focus in form fields
        var target = e.target || e.srcElement;
        return !!(target.tagName === 'INPUT' || target.tagName === 'TEXTAREA');
    }

    return {
        lastEventType: "",
        ListenMouseEvents: function() {

            document.onclick = function(e) {
                if (e.target.hasAttribute("data-action") && e.target.className !== 'original') {
                    e.preventDefault();
                }
            };

            document.onmouseup = function(e) {
                // Ignore right mouse button (context menu)
                if (e.button === 2) {
                    return;
                }

                // Auto-select input content
                if (e.target.nodeName === "INPUT" && e.target.className === "auto-select") {
                    e.target.select();
                    return;
                }

                // Application actions
                var action = e.target.getAttribute("data-action");

                if (action) {

                    Miniflux.Event.lastEventType = "mouse";

                    var currentItem = function () {
                        var element = e.target;

                        while (element && element.parentNode) {
                            element = element.parentNode;
                            if (element.tagName && element.tagName.toLowerCase() === 'article') {
                                return element;
                            }
                        }
                    }();

                    switch (action) {
                        case 'refresh-all':
                            Miniflux.Feed.UpdateAll(e.target.getAttribute("data-concurrent-requests"));
                            break;
                        case 'refresh-feed':
                            currentItem && Miniflux.Feed.Update(currentItem);
                            break;
                        case 'mark-read':
                            currentItem && Miniflux.Item.MarkAsRead(currentItem);
                            break;
                        case 'mark-unread':
                            currentItem && Miniflux.Item.MarkAsUnread(currentItem);
                            break;
                        case 'mark-removed':
                            currentItem && Miniflux.Item.MarkAsRemoved(currentItem);
                            break;
                        case 'bookmark':
                            currentItem && Miniflux.Item.SwitchBookmark(currentItem);
                            break;
                        case 'download-item':
                            currentItem && Miniflux.Item.DownloadContent(currentItem);
                            break;
                        case 'mark-feed-read':
                            var feed_id = document.getElementById('listing').getAttribute('data-feed-id');
                            Miniflux.Item.MarkFeedAsRead(feed_id);
                            break;
                        case 'close-help':
                            Miniflux.Nav.CloseHelp();
                            break;
                        case 'show-search':
                            Miniflux.Nav.ShowSearch();
                            break;
                    }
                }
            };
        },
        ListenKeyboardEvents: function() {

            document.onkeypress = function(e) {

                if (isEventIgnored(e)) {
                    return;
                }

                Miniflux.Event.lastEventType = "keyboard";

                queue.push(e.key || e.which);

                if (queue[0] === 'g' || queue[0] === 103) {

                    switch (queue[1]) {
                        case undefined:
                            break;
                        case 'u':
                        case 117:
                            window.location.href = "?action=unread";
                            queue = [];
                            break;
                        case 'b':
                        case 98:
                            window.location.href = "?action=bookmarks";
                            queue = [];
                            break;
                        case 'h':
                        case 104:
                            window.location.href = "?action=history";
                            queue = [];
                            break;
                        case 's':
                        case 115:
                            window.location.href = "?action=feeds";
                            queue = [];
                            break;
                        case 'p':
                        case 112:
                            window.location.href = "?action=config";
                            queue = [];
                            break;
                        default:
                            queue = [];
                            break;
                    }
                }
                else {

                    queue = [];

                    var currentItem = function () {
                        return document.getElementById("current-item");
                    }();

                    switch (e.key || e.which) {
                        case 'd':
                        case 100:
                            currentItem && Miniflux.Item.DownloadContent(currentItem);
                            break;
                        case 'p':
                        case 112:
                        case 'k':
                        case 107:
                            Miniflux.Nav.SelectPreviousItem();
                            break;
                        case 'n':
                        case 110:
                        case 'j':
                        case 106:
                            Miniflux.Nav.SelectNextItem();
                            break;
                        case 'v':
                        case 118:
                            currentItem && Miniflux.Item.OpenOriginal(currentItem);
                            break;
                        case 'o':
                        case 111:
                            currentItem && Miniflux.Item.Show(currentItem);
                            break;
                        case 'm':
                        case 109:
                            currentItem && Miniflux.Item.SwitchStatus(currentItem);
                            break;
                        case 'f':
                        case 102:
                            currentItem && Miniflux.Item.SwitchBookmark(currentItem);
                            break;
                        case 'h':
                        case 104:
                            Miniflux.Nav.OpenPreviousPage();
                            break;
                        case 'l':
                        case 108:
                            Miniflux.Nav.OpenNextPage();
                            break;
                        case 'r':
                        case 114:
                            Miniflux.Feed.UpdateAll();
                            break;
                        case '?':
                        case 63:
                            Miniflux.Nav.ShowHelp();
                            break;
                        case 'Q':
                        case 81:  // Q
                        case 'q':
                        case 113: // q
                            Miniflux.Nav.CloseHelp();
                            break;
                        case 'z':
                        case 122:
                            Miniflux.Item.ToggleRTLMode();
                            break;
                    }
                }
            };

            document.onkeydown = function(e) {

                if (isEventIgnored(e)) {
                    return;
                }

                Miniflux.Event.lastEventType = "keyboard";

                switch (e.key || e.which) {
                    case "ArrowLeft":
                    case "Left":
                    case 37:
                        Miniflux.Nav.SelectPreviousItem();
                        break;
                    case "ArrowRight":
                    case "Right":
                    case 39:
                        Miniflux.Nav.SelectNextItem();
                        break;
                }
            };
        },
        ListenVisibilityEvents: function() {
            document.addEventListener('visibilitychange', function() {
                Miniflux.App.Log('document.visibilityState: ' + document.visibilityState);

                if (!document.hidden && Miniflux.Item.hasNewUnread()) {
                    Miniflux.App.Log('Need to update the unread counter with fresh values from the database');
                    Miniflux.Item.CheckForUpdates();
                }
            });
        },
        ListenTouchEvents: function() {
            var touches = null;
            var resetTouch = function () {
              touches && touches.element && (touches.element.style.opacity = 1);
              touches && touches.element && (touches.element.style.transform = "");
              touches = {
                "touchstart": {"x":-1, "y":-1},
                "touchmove" : {"x":-1, "y":-1},
                "touchend"  : false,
                "direction" : "undetermined",
                "swipestarted" : false,
                "element" : null
              };
            };
            var horizontalSwipe = function () {
              if((touches.touchstart.x > -1 && touches.touchmove.x > -1 &&
                ((touches.touchmove.x - touches.touchstart.x) > 30 | touches.swipestarted) &&
                 Math.abs(touches.touchmove.y - touches.touchstart.y) < 75)) {
                     touches.swipestarted = true;
                     return touches.touchmove.x - touches.touchstart.x;
              }
              return 0;
            };
            var closest = function(el, fn) {
                return el && (fn(el) ? el : closest(el.parentNode, fn));
            };
            var getTouchElement = function() {
              return touches.element ? touches.element :
               closest(document.elementFromPoint(touches.touchstart.x, touches.touchstart.y),
                 function(el) {
                 return el.tagName === 'ARTICLE';
               });
            };
            var drawElement = function(){
              if(touches &&
                 (touches.touchend === true || touches.touchstart.x == -1)) {
                return;
              }
              if(touches.element === null) {
                touches.element = getTouchElement();
              }
              var swipedistance = horizontalSwipe();

              if(swipedistance > 0) {
                  var element = getTouchElement();
                  if(!element) {resetTouch(); return;}

                  touches.element.style.opacity = 1 -
                  ((swipedistance > 75) ? 0.9 : swipedistance/75 *0.9);
                  touches.element.style.transform = "translateX("+
                    (swipedistance > 75 ? 75 : swipedistance)+"px)";
                  touches.element = element;
              }
              window.requestAnimationFrame(drawElement);
            };
            var touchHandler = function (e) {
                if (typeof e.touches != 'undefined' && e.touches.length <= 1) {
                    var touch = e.touches[0];
                    var swipedistance = null;
                    var element = null;
                    switch (e.type) {
                      case 'touchstart':
                          resetTouch();
                          touches[e.type].x = touch.clientX;
                          touches[e.type].y = touch.clientY;
                          drawElement();
                          break;
                      case 'touchmove':
                          touches[e.type].x = touch.clientX;
                          touches[e.type].y = touch.clientY;
                          break;
                      case 'touchend':
                          touches[e.type] = true;
                          element = getTouchElement();
                          swipedistance = horizontalSwipe();
                          if(swipedistance > 75) {
                              element && Miniflux.Item.MarkAsRead(element);
                              if(!element.getAttribute("data-hide")){
                                  resetTouch();
                              }
                          } else {
                            resetTouch();
                          }
                          break;
                      case 'touchcancel':
                          resetTouch();
                          break;
                      default:
                          break;
                    }
                } else {
                  resetTouch();
                }

            };

            resetTouch();
            document.addEventListener('touchstart', touchHandler, false);
            document.addEventListener('touchmove', touchHandler, false);
            document.addEventListener('touchend', touchHandler, false);
            document.addEventListener('touchcancel', touchHandler, false);
        }
    };
})();
Miniflux.Nav = (function() {

    function scrollPageTo(item)
    {
        var clientHeight = pageYOffset + document.documentElement.clientHeight;
        var itemPosition = item.offsetTop + item.offsetHeight;

        if (clientHeight - itemPosition < 0 || clientHeight - item.offsetTop > document.documentElement.clientHeight) {
            window.scrollTo(0, item.offsetTop - 10);
        }
    }

    function findNextItem()
    {
        var items = document.getElementsByTagName("article");

        if (! document.getElementById("current-item")) {

            items[0].id = "current-item";
            scrollPageTo(items[0]);
        }
        else {

            for (var i = 0, ilen = items.length; i < ilen; i++) {

                if (items[i].id === "current-item") {

                    if (i + 1 < ilen) {
                        items[i].id = "item-" + items[i].getAttribute("data-item-id");

                        items[i + 1].id = "current-item";
                        scrollPageTo(items[i + 1]);
                    }

                    break;
                }
            }
        }
    }

    function findPreviousItem()
    {
        var items = document.getElementsByTagName("article");

        if (! document.getElementById("current-item")) {

            items[items.length - 1].id = "current-item";
            scrollPageTo(items[items.length - 1]);
        }
        else {

            for (var i = items.length - 1; i >= 0; i--) {

                if (items[i].id === "current-item") {

                    if (i - 1 >= 0) {
                        items[i].id = "item-" + items[i].getAttribute("data-item-id");
                        items[i - 1].id = "current-item";
                        scrollPageTo(items[i - 1]);
                    }

                    break;
                }
            }
        }
    }

    function isListing()
    {
        return !!document.getElementById("listing");
    }

    return {
        OpenNextPage: function() {
            var link = document.getElementById("next-page");
            if (link) link.click();
        },
        OpenPreviousPage: function() {
            var link = document.getElementById("previous-page");
            if (link) link.click();
        },
        SelectNextItem: function() {
            var link = document.getElementById("next-item");

            if (link) {
                link.click();
            }
            else if (isListing()) {
                findNextItem();
            }
        },
        SelectPreviousItem: function() {
            var link = document.getElementById("previous-item");

            if (link) {
                link.click();
            }
            else if (isListing()) {
                findPreviousItem();
            }
        },
        ShowHelp: function() {
            var help_layer = document.getElementById("help-layer");
            help_layer.removeAttribute("class");
        },
        CloseHelp: function() {
            var help_layer = document.getElementById("help-layer");
            help_layer.setAttribute("class", "hide");
        },
        ShowSearch: function() {
            document.getElementById("search-opener").setAttribute("class", "hide");
            document.getElementById("search-form").removeAttribute("class");
            document.getElementById("form-text").focus();
        },
        IsListing: isListing
    };

})();
Miniflux.App.Run();
