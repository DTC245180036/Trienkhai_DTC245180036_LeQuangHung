FROM node:18-alpine

WORKDIR /app

# Cài đặt curl phục vụ kiểm tra sức khỏe nếu cần
RUN apk --no-cache add curl

# Tạo tài khoản Non-root clinicuser để tăng cường bảo mật container
RUN addgroup -S clinicgroup && adduser -S clinicuser -G clinicgroup

COPY package*.json ./
RUN npm install --omit=dev

COPY . .

# Tạo thư mục uploads và phân quyền cho clinicuser
RUN mkdir -p /app/uploads && chown -R clinicuser:clinicgroup /app

# Chuyển sang thực thi bằng tài khoản non-root
USER clinicuser

EXPOSE 8000

CMD ["node", "server.js"]
