<?php
require_once 'config.php';

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { exit; }

// Only accept POST for inquiry submissions
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    jsonResponse(['error' => 'Method not allowed'], 405);
}

$input = json_decode(file_get_contents('php://input'), true);
if (!$input || empty($input['name'])) {
    jsonResponse(['error' => 'Name is required'], 400);
}

$data = readData();
if (!isset($data['inquiries'])) $data['inquiries'] = [];

$inquiry = [
    'id' => uniqid(),
    'name' => $input['name'] ?? '',
    'email' => $input['email'] ?? '',
    'phone' => $input['phone'] ?? '',
    'type' => $input['type'] ?? 'General',
    'message' => $input['message'] ?? '',
    'created_at' => date('Y-m-d H:i:s')
];

$data['inquiries'][] = $inquiry;
writeData($data);

jsonResponse(['success' => true, 'message' => 'Inquiry submitted successfully']);
