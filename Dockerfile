FROM nginx:alpine

# Copie des fichiers statiques du dashboard vers le dossier public de Nginx
COPY web/ /usr/share/nginx/html/

# Exposition du port standard de Nginx
EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
