<?php
session_start();
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');

define('DATA_DIR', __DIR__ . '/../data/');
define('ADMIN_USER', 'admin');
define('ADMIN_PASS', 'Bainsla@2024');

function readData() {
    $file = DATA_DIR . 'content.json';
    if (!file_exists($file)) {
        return ['banners' => [], 'artists' => [], 'releases' => [], 'videos' => [], 'catalogue' => [], 'settings' => [], 'inquiries' => []];
    }
    return json_decode(file_get_contents($file), true) ?: [];
}

function writeData($data) {
    $file = DATA_DIR . 'content.json';
    if (!is_dir(DATA_DIR)) mkdir(DATA_DIR, 0755, true);
    file_put_contents($file, json_encode($data, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));
}

function jsonResponse($data, $code = 200) {
    http_response_code($code);
    echo json_encode($data, JSON_UNESCAPED_UNICODE);
    exit;
}

function requireAuth() {
    if (!isset($_SESSION['admin_logged_in']) || $_SESSION['admin_logged_in'] !== true) {
        jsonResponse(['error' => 'Unauthorized'], 401);
    }
}
