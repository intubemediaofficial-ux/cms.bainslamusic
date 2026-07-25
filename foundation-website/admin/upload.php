<?php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');

$uploadDir = '../uploads/';

// Create uploads directory if it doesn't exist
if (!is_dir($uploadDir)) {
    mkdir($uploadDir, 0755, true);
}

if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_FILES['image'])) {
    $file = $_FILES['image'];
    
    // Validate file type
    $allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml'];
    if (!in_array($file['type'], $allowedTypes)) {
        echo json_encode(['success' => false, 'error' => 'Invalid file type. Only images allowed.']);
        exit;
    }
    
    // Max 10MB
    if ($file['size'] > 10 * 1024 * 1024) {
        echo json_encode(['success' => false, 'error' => 'File too large. Max 10MB.']);
        exit;
    }
    
    // Generate unique filename
    $ext = pathinfo($file['name'], PATHINFO_EXTENSION);
    $filename = 'img_' . time() . '_' . bin2hex(random_bytes(4)) . '.' . $ext;
    $targetPath = $uploadDir . $filename;
    
    if (move_uploaded_file($file['tmp_name'], $targetPath)) {
        $url = '/uploads/' . $filename;
        echo json_encode(['success' => true, 'url' => $url, 'filename' => $filename]);
    } else {
        echo json_encode(['success' => false, 'error' => 'Upload failed.']);
    }
} else {
    echo json_encode(['success' => false, 'error' => 'No file received.']);
}
?>
