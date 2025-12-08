# Docker Environment Configuration Guide

This guide explains how to use `.env` files with Docker Compose for the Astr application.

## Quick Setup

1. **Copy the example file:**
   ```bash
   cp .env.example .env
   ```

2. **Edit `.env` with your values:**
   ```bash
   nano .env  # or use your preferred editor
   ```

3. **Start with Docker Compose:**
   ```bash
   docker-compose up -d
   ```

## Environment Variables

### Application Settings

- `PORT` - Port the application runs on (default: `3000`)
- `NODE_ENV` - Environment mode (`development`, `production`, `test`)
- `JWT_SECRET` - **REQUIRED** - Secret key for JWT token signing

### MongoDB Settings

- `MONGODB_URI` - Full MongoDB connection string
  - Local dev: `mongodb://root:rootasdf@localhost:6545/astr?authSource=admin`
  - Docker: `mongodb://root:rootasdf@astr-mongo:27017/astr?authSource=admin`

- `MONGO_ROOT_USERNAME` - MongoDB root username (default: `root`)
- `MONGO_ROOT_PASSWORD` - MongoDB root password (default: `rootasdf`)
- `MONGO_DATABASE` - Database name (default: `astr`)

## Usage Examples

### Local Development (without Docker)

```env
PORT=3000
NODE_ENV=development
JWT_SECRET=my-dev-secret-key
MONGODB_URI=mongodb://root:rootasdf@localhost:6545/astr?authSource=admin
```

### Docker Compose

```env
PORT=3000
NODE_ENV=production
JWT_SECRET=my-production-secret-key-very-secure
MONGODB_URI=mongodb://root:rootasdf@astr-mongo:27017/astr?authSource=admin
MONGO_ROOT_USERNAME=root
MONGO_ROOT_PASSWORD=change-this-password
MONGO_DATABASE=astr
```

### Production Deployment

```env
PORT=3000
NODE_ENV=production
JWT_SECRET=use-a-very-long-random-string-here
MONGODB_URI=mongodb+srv://user:pass@cluster.mongodb.net/astr?retryWrites=true&w=majority
```

## Security Best Practices

1. **Never commit `.env` to git** - It's already in `.gitignore`
2. **Use strong JWT secrets** - Generate with: `openssl rand -base64 32`
3. **Change default MongoDB credentials** in production
4. **Use environment-specific files** - `.env.development`, `.env.production`

## Troubleshooting

### Docker Compose not reading .env file

Make sure:
- `.env` file is in the same directory as `docker-compose.yml`
- File is named exactly `.env` (not `.env.txt`)
- No spaces around `=` in variable assignments

### MongoDB connection errors

Check:
- MongoDB container is running: `docker-compose ps`
- Credentials match between `.env` and `MONGODB_URI`
- Using correct hostname (`localhost` vs `astr-mongo`)
