FROM php:8.2-apache

# =========================
# SYSTEM
# =========================
RUN apt-get update && apt-get install -y \
    git unzip zip curl \
    libicu-dev libzip-dev libonig-dev \
    && docker-php-ext-install intl pdo pdo_mysql zip opcache mbstring

# =========================
# APACHE
# =========================
RUN a2enmod rewrite

# FORCE PORT RENDER
RUN sed -i 's/80/10000/g' /etc/apache2/ports.conf

# FORCE DOCUMENT ROOT (IMPORTANT)
RUN sed -i 's|/var/www/html|/var/www/public|g' /etc/apache2/sites-available/000-default.conf

# HARD RESET VHOST (IMPORTANT FIX)
RUN printf '<VirtualHost *:10000>\n\
    DocumentRoot /var/www/public\n\
    <Directory /var/www/public>\n\
        AllowOverride All\n\
        Require all granted\n\
    </Directory>\n\
</VirtualHost>\n' > /etc/apache2/sites-available/000-default.conf

# =========================
# COMPOSER
# =========================
COPY --from=composer:2 /usr/bin/composer /usr/bin/composer

WORKDIR /var/www

COPY . .

# =========================
# ENV
# =========================
ENV APP_ENV=prod
ENV APP_DEBUG=0

# =========================
# INSTALL
# =========================
RUN composer install --no-dev --optimize-autoloader --no-interaction --prefer-dist --no-scripts

RUN php bin/console cache:clear --env=prod
RUN php bin/console cache:warmup --env=prod

# =========================
# DEBUG PROOF (IMPORTANT)
# =========================
RUN echo "SYMFONY BUILD OK" > /var/www/public/build.txt

# =========================
# PERMISSIONS
# =========================
RUN chown -R www-data:www-data /var/www

EXPOSE 10000

CMD ["apache2-foreground"]