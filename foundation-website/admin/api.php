<?php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST');
header('Access-Control-Allow-Headers: Content-Type');

$dataDir = __DIR__ . '/data/';

// Create data directory if not exists
if (!is_dir($dataDir)) {
    mkdir($dataDir, 0755, true);
}

$action = $_GET['action'] ?? $_POST['action'] ?? '';
$type = $_GET['type'] ?? $_POST['type'] ?? '';

// Allowed data types
$allowedTypes = ['donations', 'bookings', 'volunteers', 'messages', 'donorWall', 'gallery', 'blogs', 'team', 'programs', 'settings', 'bankDetails', 'bannerContent', 'razorpay'];

if (!in_array($type, $allowedTypes) && $action !== 'getAll') {
    echo json_encode(['error' => 'Invalid type']);
    exit;
}

switch ($action) {
    case 'save':
        $input = file_get_contents('php://input');
        $data = json_decode($input, true);
        if ($data === null && !empty($input)) {
            echo json_encode(['error' => 'Invalid JSON']);
            exit;
        }
        file_put_contents($dataDir . $type . '.json', json_encode($data, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));
        echo json_encode(['success' => true, 'message' => $type . ' saved']);
        break;

    case 'load':
        $file = $dataDir . $type . '.json';
        if (file_exists($file)) {
            echo file_get_contents($file);
        } else {
            echo json_encode([]);
        }
        break;

    case 'getAll':
        $allData = [];
        foreach ($allowedTypes as $t) {
            $file = $dataDir . $t . '.json';
            if (file_exists($file)) {
                $allData[$t] = json_decode(file_get_contents($file), true);
            } else {
                $allData[$t] = [];
            }
        }
        echo json_encode($allData);
        break;

    default:
        echo json_encode(['error' => 'Invalid action. Use: save, load, getAll']);
}
?>
