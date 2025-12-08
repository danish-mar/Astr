# Docker Container Admin Setup Guide

This guide explains how to create the initial admin user by accessing the Docker container's bash shell.

## Quick Method: Using Docker Exec

### Step 1: Start the containers
```bash
docker-compose up -d
```

### Step 2: Access the container's bash
```bash
docker exec -it astr-app sh
```
*Note: Alpine Linux uses `sh` instead of `bash`*

### Step 3: Run the admin creation script
```bash
npm run create-admin
```

### Step 4: Follow the prompts
```
Enter admin username: admin
Enter admin name: Administrator
Enter admin password (min 6 characters): admin123
Enter admin email (optional, press enter to skip): admin@astr.local
Enter admin phone (optional, press enter to skip): 
```

### Step 5: Exit the container
```bash
exit
```

## Alternative: One-Line Command

You can also run the admin creation in one command:

```bash
docker exec -it astr-app npm run create-admin
```

## Using Docker Compose Exec

If you prefer using docker-compose:

```bash
docker-compose exec astr-app npm run create-admin
```

## Complete Example Session

```bash
# Start services
$ docker-compose up -d
Creating network "astr_astr-network" ... done
Creating astr-mongo ... done
Creating astr-app   ... done

# Create admin user
$ docker exec -it astr-app npm run create-admin

> create-admin
> ts-node src/utils/createAdmin.ts

🔐 Admin User Creation Script

==================================================
Enter admin username: admin
Enter admin name: System Administrator
Enter admin password (min 6 characters): admin123
Enter admin email (optional, press enter to skip): admin@example.com
Enter admin phone (optional, press enter to skip): 

📝 Creating admin user...

✅ Admin user created successfully!

==================================================
📋 Admin Details:
   Username: admin
   Name: System Administrator
   Position: Admin
   Email: admin@example.com
==================================================

🔐 Login Credentials:
   Username: admin
   Password: admin123

⚠️  Please save these credentials securely!
```

## Troubleshooting

### Container not running
```bash
# Check container status
docker-compose ps

# View logs
docker-compose logs astr-app

# Restart containers
docker-compose restart
```

### Database connection issues
```bash
# Check MongoDB is running
docker-compose ps astr-mongo

# Check MongoDB logs
docker-compose logs astr-mongo

# Verify network connectivity
docker exec -it astr-app ping astr-mongo
```

### TypeScript/Node.js issues
```bash
# Check if dist folder exists
docker exec -it astr-app ls -la dist/

# Rebuild if needed
docker exec -it astr-app npm run build

# Then try create-admin again
docker exec -it astr-app npm run create-admin
```

## Using Seed Data Instead

If you want to quickly set up test data including an admin user:

```bash
docker exec -it astr-app npm run seed
```

This will create:
- Default admin user (username: `admin`, password: `admin123`)
- Sample products
- Sample contacts
- Sample service tickets

## Production Recommendations

1. **Change default credentials immediately** after first login
2. **Use strong passwords** (minimum 12 characters, mixed case, numbers, symbols)
3. **Disable or remove seed script** in production
4. **Create admin via secure method** (not interactive terminal in production)
5. **Use environment variables** for initial admin credentials if automating

## Automated Admin Creation (Production)

For production deployments, consider creating a non-interactive admin creation script:

```bash
# Example: Create admin via environment variables
docker exec -e ADMIN_USER=admin \
            -e ADMIN_PASS=secure-password \
            -e ADMIN_NAME="Administrator" \
            -e ADMIN_EMAIL=admin@company.com \
            astr-app node dist/utils/createAdminNonInteractive.js
```

*Note: You would need to create the non-interactive script separately*

## Common Commands Reference

```bash
# Start containers
docker-compose up -d

# Stop containers
docker-compose down

# View logs
docker-compose logs -f astr-app

# Access container shell
docker exec -it astr-app sh

# Run admin creation
docker exec -it astr-app npm run create-admin

# Run seed data
docker exec -it astr-app npm run seed

# Restart app container
docker-compose restart astr-app

# Rebuild and restart
docker-compose up -d --build
```
