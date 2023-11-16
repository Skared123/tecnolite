#############################################################
# DockerFile Ciosa catalog
#############################################################

# Imagen Base
FROM node:18.14

# Actualización de SO
RUN apt-get upgrade -y > /dev/null && apt-get update > /dev/null

# Crear directorio de trabajo
RUN mkdir /app

# Establecer directorio de trabajo
WORKDIR /app

# Añadir ruta a las variables de entorno
ENV PATH /app/node_modules/.bin:$PATH

# Copiar paquetes de dependencias
COPY package*.json /app

# Instalación de paquetes
RUN npm install

# Copia la app
COPY . /app

EXPOSE 8080

# Inicia la app con el contenedor
ENTRYPOINT [ "npm", "start" ]
