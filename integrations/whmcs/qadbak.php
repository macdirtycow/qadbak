<?php
/**
 * WHMCS provisioning module starter for Qadbak API v1.
 * Configure: panel URL, API bearer token (Admin → API keys).
 */
if (!defined('WHMCS')) {
    die('This file cannot be accessed directly');
}

function qadbak_MetaData()
{
    return [
        'DisplayName' => 'Qadbak',
        'APIVersion' => '1.1',
        'RequiresServer' => true,
    ];
}

function qadbak_ConfigOptions()
{
    return [
        'API Token' => [
            'Type' => 'password',
            'Description' => 'Bearer token from Qadbak admin',
        ],
    ];
}

function qadbak_api($params, $method, $path, $body = null)
{
    $base = rtrim($params['serverhostname'] ?: $params['serverip'], '/');
    $url = $base . '/api/v1' . $path;
    $ch = curl_init($url);
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_CUSTOMREQUEST => $method,
        CURLOPT_HTTPHEADER => [
            'Authorization: Bearer ' . $params['configoption1'],
            'Content-Type: application/json',
        ],
    ]);
    if ($body !== null) {
        curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($body));
    }
    $raw = curl_exec($ch);
    $code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    if ($code >= 400) {
        return ['error' => $raw ?: "HTTP $code"];
    }
    return json_decode($raw, true) ?: [];
}

function qadbak_CreateAccount($params)
{
    $domain = $params['domain'];
    $r = qadbak_api($params, 'POST', '/domains', [
        'domain' => $domain,
        'user' => preg_replace('/[^a-z0-9_-]/', '', explode('.', $domain)[0]),
        'plan' => $params['configoption2'] ?? '',
    ]);
    return isset($r['error']) ? $r['error'] : 'success';
}

function qadbak_TerminateAccount($params)
{
    $domain = $params['domain'];
    $r = qadbak_api($params, 'DELETE', '/domains/' . rawurlencode($domain));
    return isset($r['error']) ? $r['error'] : 'success';
}

function qadbak_SuspendAccount($params)
{
    return 'success'; // hook: domain-disable via extended API when added
}

function qadbak_UnsuspendAccount($params)
{
    return 'success';
}
