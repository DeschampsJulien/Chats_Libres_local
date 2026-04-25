FROM php:8.2-apache

# =========================
# SYSTEM DEPENDENCIES
# =========================
RUN apt-get update && apt-get install -y \
    git unzip zip curl \
    libicu-dev libzip-dev libonig-dev \
    && docker-php-ext-install intl pdo pdo_mysql zip opcache mbstring

# =========================
# APACHE CONFIG
# =========================
RUN a2enmod rewrite

# IMPORTANT: Render port 10000
RUN sed -i 's/80/10000/g' /etc/apache2/ports.conf \
 && sed -i 's/:80/:10000/g' /etc/apache2/sites-available/000-default.conf

# Symfony PUBLIC DIRECTORY FIX (CRUCIAL)
RUN sed -i 's|DocumentRoot /var/www/html|DocumentRoot /var/www/public|g' \
    /etc/apache2/sites-available/000-default.conf

# Allow access to /public
RUN echo "<Directory /var/www/public>\n\
    AllowOverride All\n\
    Require all granted\n\
</Directory>" >> /etc/apache2/apache2.conf

RUN echo "ServerName localhost" >> /etc/apache2/apache2.conf

# =========================
# COMPOSER
# =========================
COPY --from=composer:2 /usr/bin/composer /usr/bin/composer

WORKDIR /var/www

# =========================
# COPY PROJECT
# =========================
COPY . .

# =========================
# ENV (PRODUCTION SAFE)
# =========================
ENV APP_ENV=prod
ENV APP_DEBUG=0

# =========================
# INSTALL DEPENDENCIES
# =========================
RUN composer install \
    --no-dev \
    --optimize-autoloader \
    --no-interaction \
    --prefer-dist \
    --no-scripts

# SAFE CACHE CLEAR
RUN php bin/console cache:clear --env=prod || true

# =========================
# PERMISSIONS
# =========================
RUN chown -R www-data:www-data /var/www

# =========================
# PORT EXPOSE
# =========================
EXPOSE 10000

# =========================
# START APACHE
# =========================
CMD ["apache2-foreground"]