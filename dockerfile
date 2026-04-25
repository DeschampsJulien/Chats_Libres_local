FROM php:8.2-apache

# Dépendances système + extensions PHP
RUN apt-get update && apt-get install -y \
    git unzip libicu-dev libzip-dev zip libonig-dev \
    && docker-php-ext-install intl pdo pdo_mysql zip opcache mbstring

# Apache rewrite (Symfony obligatoire)
RUN a2enmod rewrite

# Composer
COPY --from=composer:latest /usr/bin/composer /usr/bin/composer

WORKDIR /var/www

# Copier le projet
COPY . .

# FORCE PROD (IMPORTANT pour Render)
ENV APP_ENV=prod
ENV APP_DEBUG=0

# Installer dépendances SANS scripts (évite crash Dotenv/cache)
RUN composer install --no-dev --optimize-autoloader --no-scripts

# Nettoyage cache SAFE
RUN php bin/console cache:clear --env=prod --no-warmup || true

# Apache vers /public (Symfony obligatoire)
RUN sed -i 's|DocumentRoot /var/www/html|DocumentRoot /var/www/public|g' \
    /etc/apache2/sites-available/000-default.conf

# Permissions
RUN chown -R www-data:www-data /var/www

# Port Render
EXPOSE 10000

# Adapter Apache port Render
RUN sed -i 's/80/10000/g' /etc/apache2/ports.conf /etc/apache2/sites-enabled/000-default.conf

CMD ["apache2-foreground"]