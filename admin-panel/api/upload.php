<?php
require_once 'config.php';
requireAuth();

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    jsonResponse(['error' => 'Method not allowed'], 405);
}

if (!isset($_FILES['image'])) {
    jsonResponse(['error' => 'No file uploaded'], 400);
}

$file = $_FILES['image'];
$folder = $_POST['folder'] ?? 'uploads';
$allowed = ['jpg', 'jpeg', 'png', 'gif', 'webp'];
$ext = strtolower(pathinfo($file['name'], PATHINFO_EXTENSION));

if (!in_array($ext, $allowed)) {
    jsonResponse(['error' => 'Invalid file type. Allowed: ' . implode(', ', $allowed)], 400);
}

$uploadDir = __DIR__ . '/../images/' . $folder . '/';
if (!is_dir($uploadDir)) {
    mkdir($uploadDir, 0755, true);
}

$filename = uniqid() . '_' . preg_replace('/[^a-zA-Z0-9._-]/', '', $file['name']);
$filepath = $uploadDir . $filename;

if (move_uploaded_file($file['tmp_name'], $filepath)) {
    jsonResponse([
        'success' => true,
        'url' => '/images/' . $folder . '/' . $filename,
        'filename' => $filename
    ]);
} else {
    jsonResponse(['error' => 'Upload failed'], 500);
}
