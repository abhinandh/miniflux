<?php

namespace PicoFeed\Client;

use PicoFeed\Logging\Logger;

/**
 * A client that calls sandstorm-httpGet
 *
 * @author  Abhinand Palicherla
 */
class SandstormGet extends Client 
{
    private $spath = "/usr/bin/sandstorm-httpGet";

    private function getSandstormSessionId() {
        $key = "HTTP_X_SANDSTORM_SESSION_ID";
        return $_SERVER[$key];
    }

    /**
     * Do the HTTP request.
     *
     * @return array HTTP response ['body' => ..., 'status' => ..., 'headers' => ...]
     */
    public function doRequest()
    {
        // TODO: Authentication.
        //       Headers - feed modification decision depends on that.
        $output = 
            shell_exec($this->spath . ' "' . $this->url . '" ' . $this->getSandstormSessionId());

        // TODO: Return the right error code based on STDERR.
        if ($output == NULL) {
            throw new InvalidUrlException('Unable to fetch the URL', 0);
        }

        return array(
            'status' => 200,
            'body' => $output,
            'headers' => '',
        );
    }

}
