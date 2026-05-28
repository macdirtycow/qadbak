<?php
/**
 * Blesta provisioning module starter for Qadbak API v1.
 * Package: copy to components/modules/servers/qadbak/
 */
class Qadbak extends Server
{
    public function getName()
    {
        return 'Qadbak';
    }

    private function api($host, $token, $method, $path, $body = null)
    {
        $url = rtrim($host, '/') . '/api/v1' . $path;
        $ch = curl_init($url);
        $headers = [
            'Authorization: Bearer ' . $token,
            'Content-Type: application/json',
        ];
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_CUSTOMREQUEST, $method);
        curl_setopt($ch, CURLOPT_HTTPHEADER, $headers);
        if ($body !== null) {
            curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($body));
        }
        $raw = curl_exec($ch);
        curl_close($ch);
        return json_decode($raw, true) ?: [];
    }

    public function addService(
        $package,
        $service,
        $parent_package = null,
        $parent_service = null,
        $status = null
    ) {
        $token = $package->meta->api_token ?? '';
        $host = $package->meta->host ?? '';
        $domain = $service->name;
        $this->api($host, $token, 'POST', '/domains', ['domain' => $domain]);
        return null;
    }

    public function suspendService($package, $service, $parent_package = null, $parent_service = null)
    {
        return null;
    }

    public function unsuspendService($package, $service, $parent_package = null, $parent_service = null)
    {
        return null;
    }

    public function cancelService($package, $service, $parent_package = null, $parent_service = null)
    {
        $token = $package->meta->api_token ?? '';
        $host = $package->meta->host ?? '';
        $this->api($host, $token, 'DELETE', '/domains/' . rawurlencode($service->name));
        return null;
    }
}
