FROM php:8.2-apache

RUN apt-get update && apt-get install -y \
    git unzip zip curl \
    libicu-dev libzip-dev libonig-dev libpq-dev \
    && docker-php-ext-install intl pdo pdo_pgsql zip opcache mbstring

RUN a2enmod rewrite

RUN sed -i 's/80/10000/g' /etc/apache2/ports.conf

RUN sed -i 's|/var/www/html|/var/www/public|g' \
    /etc/apache2/sites-available/000-default.conf

RUN printf '<VirtualHost *:10000>\n\
DocumentRoot /var/www/public\n\
<Directory /var/www/public>\n\
AllowOverride All\n\
Require all granted\n\
</Directory>\n\
</VirtualHost>\n' > /etc/apache2/sites-available/000-default.conf

COPY --from=composer:2 /usr/bin/composer /usr/bin/composer

WORKDIR /var/www

COPY . .

ENV APP_ENV=prod
ENV APP_DEBUG=0

RUN composer install \
    --no-dev \
    --optimize-autoloader \
    --no-interaction \
    --prefer-dist \
    --no-scripts

RUN echo "SYMFONY BUILD OK" > /var/www/public/build.txt

RUN chown -R www-data:www-data /var/www

EXPOSE 10000

CMD ["apache2-foreground"]