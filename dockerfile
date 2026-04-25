FROM php:8.2-apache

# System deps
RUN apt-get update && apt-get install -y \
    git unzip libicu-dev libzip-dev zip libonig-dev \
    && docker-php-ext-install intl pdo pdo_mysql zip opcache mbstring

# Apache
RUN a2enmod rewrite

# Composer
COPY --from=composer:latest /usr/bin/composer /usr/bin/composer

WORKDIR /var/www
COPY . .

# PROD MODE ONLY
ENV APP_ENV=prod
ENV APP_DEBUG=0

# Install dependencies (NO dotenv needed)
RUN composer install --no-dev --optimize-autoloader

# Cache warmup safe
RUN php bin/console cache:clear --env=prod || true

# Apache config Symfony
RUN sed -i 's|DocumentRoot /var/www/html|DocumentRoot /var/www/public|g' \
    /etc/apache2/sites-available/000-default.conf

RUN chown -R www-data:www-data /var/www

EXPOSE 10000

RUN sed -i 's/80/10000/g' /etc/apache2/ports.conf /etc/apache2/sites-enabled/000-default.conf

CMD ["apache2-foreground"]