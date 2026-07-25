<?php
require_once 'config.php';

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { exit; }

$input = json_decode(file_get_contents('php://input'), true);
$user = $input['username'] ?? '';
$pass = $input['password'] ?? '';

if ($user === ADMIN_USER && $pass === ADMIN_PASS) {
    $_SESSION['admin_logged_in'] = true;
    jsonResponse(['success' => true, 'message' => 'Login successful']);
} else {
    jsonResponse(['success' => false, 'message' => 'Invalid credentials'], 401);
}
