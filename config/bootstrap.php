<?php

use Symfony\Component\Dotenv\Dotenv;

if (!isset($_SERVER['APP_ENV'])) {
    $_SERVER['APP_ENV'] = 'prod';
    $_ENV['APP_ENV'] = 'prod';
}

if (!isset($_SERVER['APP_DEBUG'])) {
    $_SERVER['APP_DEBUG'] = false;
    $_ENV['APP_DEBUG'] = false;
}