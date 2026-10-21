FROM node:18-alpine

WORKDIR /app

# Cài đặt curl phục vụ kiểm tra sức khỏe nếu cần
RUN apk --no-cache add curl

COPY package*.json ./
RUN npm install --omit=dev

COPY . .

# Tạo thư mục uploads
RUN mkdir -p /app/uploads

EXPOSE 8000

CMD ["node", "server.js"]
