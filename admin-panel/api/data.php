<?php
require_once 'config.php';

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { exit; }

$method = $_SERVER['REQUEST_METHOD'];
$section = $_GET['section'] ?? '';

// Public read access (no auth needed)
if ($method === 'GET' && $section === 'public') {
    $data = readData();
    jsonResponse($data);
}

requireAuth();

switch ($method) {
    case 'GET':
        $data = readData();
        if ($section && isset($data[$section])) {
            jsonResponse($data[$section]);
        }
        jsonResponse($data);
        break;

    case 'POST':
        $data = readData();
        $input = json_decode(file_get_contents('php://input'), true);
        if (!$section || !$input) {
            jsonResponse(['error' => 'Missing section or data'], 400);
        }
        // Settings is an object, not array
        if ($section === 'settings') {
            $data['settings'] = array_merge($data['settings'] ?? [], $input);
            writeData($data);
            jsonResponse(['success' => true]);
            break;
        }
        if (!isset($data[$section])) $data[$section] = [];
        $input['id'] = uniqid();
        $input['created_at'] = date('Y-m-d H:i:s');
        $data[$section][] = $input;
        writeData($data);
        jsonResponse(['success' => true, 'id' => $input['id']]);
        break;

    case 'PUT':
        $data = readData();
        $input = json_decode(file_get_contents('php://input'), true);
        $id = $_GET['id'] ?? '';
        if (!$section || !$input) {
            jsonResponse(['error' => 'Missing section or data'], 400);
        }
        // Settings update
        if ($section === 'settings') {
            $data['settings'] = array_merge($data['settings'] ?? [], $input);
            writeData($data);
            jsonResponse(['success' => true]);
            break;
        }
        if (!$id) {
            jsonResponse(['error' => 'Missing id'], 400);
        }
        if (isset($data[$section])) {
            foreach ($data[$section] as $i => $item) {
                if (($item['id'] ?? '') === $id) {
                    $data[$section][$i] = array_merge($item, $input);
                    writeData($data);
                    jsonResponse(['success' => true]);
                }
            }
        }
        jsonResponse(['error' => 'Item not found'], 404);
        break;

    case 'DELETE':
        $data = readData();
        $id = $_GET['id'] ?? '';
        if (!$section || !$id) {
            jsonResponse(['error' => 'Missing section or id'], 400);
        }
        if (isset($data[$section])) {
            $data[$section] = array_values(array_filter($data[$section], function($item) use ($id) {
                return ($item['id'] ?? '') !== $id;
            }));
            writeData($data);
            jsonResponse(['success' => true]);
        }
        jsonResponse(['error' => 'Section not found'], 404);
        break;

    default:
        jsonResponse(['error' => 'Method not allowed'], 405);
}
