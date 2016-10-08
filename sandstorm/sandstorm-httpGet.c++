// Sandstorm - Personal Cloud Sandbox
// Copyright (c) 2014 Sandstorm Development Group, Inc. and contributors
//
// This file is part of the Sandstorm API, which is licensed under the MIT license:
//
// Permission is hereby granted, free of charge, to any person obtaining a copy
// of this software and associated documentation files (the "Software"), to deal
// in the Software without restriction, including without limitation the rights
// to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
// copies of the Software, and to permit persons to whom the Software is
// furnished to do so, subject to the following conditions:
//
// The above copyright notice and this permission notice shall be included in
// all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
// IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
// FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
// AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
// LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
// OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
// THE SOFTWARE.

// This program is useful for including in Sandstorm application packages where
// the application itself is a legacy HTTP web server that does not understand
// how to speak the Cap'n Proto interface directly.  This program will start up
// that server and then redirect incoming requests to it over standard HTTP on
// the loopback network interface.

// Hack around stdlib bug with C++14.
#include <initializer_list>  // force libstdc++ to include its config
#undef _GLIBCXX_HAVE_GETS    // correct broken config
// End hack.

#include <kj/main.h>
#include <kj/debug.h>
#include <kj/async-io.h>
#include <kj/async-unix.h>
#include <kj/io.h>
#include <capnp/rpc-twoparty.h>
#include <capnp/rpc.capnp.h>
#include <capnp/ez-rpc.h>
#include <unistd.h>
#include <sandstorm/sandstorm-http-bridge.capnp.h>

#include <sandstorm/hack-session.capnp.h>

namespace sandstorm {

typedef unsigned int uint;
typedef unsigned char byte;

class GetHttpMain {
public:
  GetHttpMain(kj::ProcessContext& context): context(context) { }

  kj::MainFunc getMain() {
    return kj::MainBuilder(context, "HttpGet version: 0.0.1",
                           "Runs the httpGet command from hack-session.capnp. "
                           "Takes one argument, the url, and returns the contents on stdout.")
        .expectArg("<url>", KJ_BIND_METHOD(*this, setUrl))
        .expectArg("<sessionId>", KJ_BIND_METHOD(*this, setSessionId))
        .callAfterParsing(KJ_BIND_METHOD(*this, run))
        .build();
  }

  kj::MainBuilder::Validity setUrl(kj::StringPtr url) {
    this->url = kj::str(url);
    return true;
  }

  kj::MainBuilder::Validity setSessionId(kj::StringPtr id) {
      sessionId = kj::heapString(id);
      return true;
  }

  kj::MainBuilder::Validity run() {
    capnp::EzRpcClient client("unix:/tmp/sandstorm-api");
    SandstormHttpBridge::Client restorer = client.getMain<SandstormHttpBridge>();

    auto request = restorer.getSessionContextRequest();
    request.setId(sessionId);
    auto session = request.send().getContext().castAs<HackSessionContext>();

    auto httpGet = session.httpGetRequest();
    httpGet.setUrl(url);
    auto httpGetPromise = httpGet.send().then([](auto result) {

        auto content = result.getContent();
        kj::FdOutputStream(STDOUT_FILENO).write(content.begin(), content.size());

    }, [] (auto e) {
        auto desc = e.getDescription();
        kj::FdOutputStream(STDERR_FILENO).write(desc.begin(), desc.size());
        // Thrown and exception so that a negative error code is returned
        // by the process.
        throw kj::TopLevelProcessContext::CleanShutdownException { -1 };
    });

    httpGetPromise.wait(client.getWaitScope());
    return true;
  }

private:
  kj::ProcessContext& context;
  kj::String url;
  kj::String sessionId;
};

}  // namespace sandstorm

KJ_MAIN(sandstorm::GetHttpMain)
