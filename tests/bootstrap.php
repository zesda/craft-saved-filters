<?php

$autoloader = __DIR__ . '/../vendor/autoload.php';

if (!is_file($autoloader)) {
    fwrite(STDERR, "Composer dependencies are not installed. Run composer install.\n");
    exit(1);
}

require $autoloader;
