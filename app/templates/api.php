<div class="page-header">
    <h2><?= $title ?></h2>
    <nav>
        <ul>
            <li><a href="?action=config"><?= t('general') ?></a></li>
            <li><a href="?action=services"><?= t('external services') ?></a></li>
            <li class="active"><a href="?action=api"><?= t('api') ?></a></li>
            <li><a href="?action=database"><?= t('database') ?></a></li>
            <li><a href="?action=help"><?= t('help') ?></a></li>
            <li><a href="?action=about"><?= t('about') ?></a></li>
        </ul>
    </nav>
</div>
<section>

<script>
function requestIframeURL() {
    var template = "$API_TOKEN";
    window.parent.postMessage({renderTemplate: {
        rpcId: "1",
        template: template,
        clipboardButton: "right",
    }}, "*");
    var template = "http://$API_HOST/jsonrpc.php";
    window.parent.postMessage({renderTemplate: {
        rpcId: "2",
        template: template,
        clipboardButton: "right",
    }}, "*");
}

document.addEventListener("DOMContentLoaded", requestIframeURL);

var copyIframeURLToElement = function(event) {
    if (event.data.rpcId === "1") {
        if (event.data.error) {
            console.log("ERROR: " + event.data.error);
        } else {
            el = document.getElementById("miniflux_api_token");
            el.setAttribute("src", event.data.uri);
        }
    } else if (event.data.rpcId === "2") {
        if (event.data.error) {
            console.log("ERROR: " + event.data.error);
        } else {
            var el = document.getElementById("miniflux_api_base");
            el.setAttribute("src", event.data.uri);
        }
    }
};
window.addEventListener("message", copyIframeURLToElement);
</script>

<style>
.if {
    width: 80%;
    height: 20px;
    margin: 0;
    margin-left: 10px;
    border: 0;
}
</style>

<!--
    <div class="panel panel-default">
        <h3 id="fever"><?= t('Fever API') ?></h3>
        <ul>
            <li><?= t('API endpoint:') ?> <strong><?= Miniflux\Helper\get_current_base_url(), 'fever/' ?></strong></li>
            <li><?= t('API username:') ?> <strong><?= Miniflux\Helper\escape($config['username']) ?></strong></li>
            <li><?= t('API token:') ?> <strong><?= Miniflux\Helper\escape($config['fever_token']) ?></strong></li>
        </ul>
    </div>
-->
    <div class="panel panel-default">
        <h3 id="api"><?= t('Miniflux API') ?></h3>
        <ul>
            <li><?= t('API endpoint:') ?> <strong><iframe class="if" id="miniflux_api_base"></iframe></strong></li>
            <li><?= t('API token:') ?> <strong><iframe class="if" id="miniflux_api_token"></iframe></strong></li>
        </ul>
    </div>

</section>
