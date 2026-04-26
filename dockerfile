FROM php:8.2-apache

# ======================
# SYSTEM
# ======================
RUN apt-get update && apt-get install -y \
    git unzip zip curl \
    libicu-dev libzip-dev libonig-dev \
    && docker-php-ext-install intl pdo pdo_mysql zip opcache mbstring

# ======================
# APACHE
# ======================
RUN a2enmod rewrite

# Render port
RUN sed -i 's/80/10000/g' /etc/apache2/ports.conf

# Symfony public folder
RUN sed -i 's|/var/www/html|/var/www/public|g' \
    /etc/apache2/sites-available/000-default.conf

RUN printf '<VirtualHost *:10000>\n\
DocumentRoot /var/www/public\n\
<Directory /var/www/public>\n\
AllowOverride All\n\
Require all granted\n\
</Directory>\n\
</VirtualHost>\n' > /etc/apache2/sites-available/000-default.conf

# ======================
# COMPOSER
# ======================
COPY --from=composer:2 /usr/bin/composer /usr/bin/composer

WORKDIR /var/www

# ======================
# COPY PROJECT
# ======================
COPY . .

# ======================
# ENV (SAFE DEFAULTS)
# ======================
ENV APP_ENV=prod
ENV APP_DEBUG=0

# ======================
# INSTALL DEPENDENCIES
# ======================
RUN composer install \
    --no-dev \
    --optimize-autoloader \
    --no-interaction \
    --prefer-dist \
    --no-scripts

# ⚠️ IMPORTANT: NO Symfony cache clear here
# (DATABASE_URL not available at build time)

# ======================
# DEBUG FILE (OPTIONAL BUT USEFUL)
# ======================
RUN echo "SYMFONY BUILD OK" > /var/www/public/build.txt

# ======================
# PERMISSIONS
# ======================
RUN chown -R www-data:www-data /var/www

EXPOSE 10000

CMD ["apache2-foreground"]