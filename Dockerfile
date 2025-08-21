FROM node:20-alpine

WORKDIR /app

# Copia os arquivos de manifesto primeiro
COPY package*.json ./

# Instala dependências
RUN npm install --production

# Copia o restante do código
COPY . .

# Expõe a porta do servidor
EXPOSE 3000

# Inicia o servidor Node
CMD ["node", "index.js"]
