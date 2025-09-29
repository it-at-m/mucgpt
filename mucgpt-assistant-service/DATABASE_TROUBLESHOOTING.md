# Database Connection Debugging Tools

This directory contains enhanced debugging tools to help diagnose database connection issues, particularly the `password authentication failed` error you're experiencing.

## 🛠️ Available Tools

### 1. `check_env.py` - Environment Variables Checker
**Use this first!** This script checks if all required environment variables are set correctly.

```bash
python check_env.py
```

**What it checks:**
- All required database environment variables
- Password length and format issues
- Logging configuration
- Provides troubleshooting tips

### 2. `set-debug-env.ps1` - PowerShell Environment Setup
Quick setup script for debugging sessions (Windows PowerShell).

```powershell
# Edit the script first to set your database credentials
./set-debug-env.ps1
```

**What it does:**
- Sets all required environment variables
- Enables debug logging
- Runs the environment checker
- Shows connection details

### 3. Enhanced `session.py` - Database Session with Debugging
The main database session handler now includes:

- ✅ Detailed connection logging
- ✅ Password authentication error analysis
- ✅ Connection timeout and network issue detection
- ✅ Database existence checks
- ✅ Masked password logging (secure)

### 4. `debug_db_config.py` - Full Database Debug Suite
Comprehensive database debugging (requires application imports).

```bash
cd src && python ../debug_db_config.py
```

### 5. `validate_startup.py` - Startup Validation
Pre-startup validation script (requires application imports).

```bash
cd src && python ../validate_startup.py
```

## 🔧 Quick Troubleshooting Steps

### Step 1: Check Environment Variables
```bash
python check_env.py
```

### Step 2: Set Missing Variables
If variables are missing, either:
- Use the PowerShell script: `./set-debug-env.ps1` (edit first!)
- Set manually:
  ```bash
  export MUCGPT_ASSISTANT_DB_HOST="your-db-host"
  export MUCGPT_ASSISTANT_DB_PORT="5432"
  export MUCGPT_ASSISTANT_DB_NAME="your-db-name"
  export MUCGPT_ASSISTANT_DB_USER="mucgpt-database-admin"
  export MUCGPT_ASSISTANT_DB_PASSWORD="your-password"
  ```

### Step 3: Enable Debug Logging
```bash
export LOG_LEVEL_MUCGPT_ASSISTANT_SERVICE=DEBUG
export LOG_LEVEL_ROOT=INFO
```

### Step 4: Test Connection
Run your application and check the logs for detailed connection information.

## 🔍 Understanding Your Error

The error `asyncpg.exceptions.InvalidPasswordError: password authentication failed for user "mucgpt-database-admin"` typically indicates:

1. **Wrong password** - Check `MUCGPT_ASSISTANT_DB_PASSWORD`
2. **Wrong username** - Verify `MUCGPT_ASSISTANT_DB_USER`
3. **User doesn't exist** - Check if user exists in database
4. **User lacks permissions** - Verify login permissions
5. **Database doesn't exist** - Check if database exists
6. **Connection to wrong server** - Verify host and port

## 📊 Enhanced Logging Output

With debug logging enabled, you'll now see:
- Database URL creation (with masked passwords)
- Connection attempt details
- Specific error analysis with emoji indicators
- Troubleshooting suggestions
- Connection pool status

## 🔐 Security Notes

- Passwords are always masked in logs
- Only password length is logged for debugging
- No sensitive data is exposed in error messages

## 💡 Pro Tips

1. **Always run `check_env.py` first** - it's the fastest way to identify issues
2. **Enable debug logging** - provides much more detailed information
3. **Check password for whitespace** - trailing/leading spaces cause auth failures
4. **Verify database server is running** - connection refused errors are common
5. **Test with a database client first** - verify credentials work outside the application

## 🆘 If You're Still Stuck

The enhanced logging will now provide specific guidance based on the error type. Look for emoji indicators in the logs:
- 🔐 Password/authentication issues
- 🔌 Connection refused (server down/wrong port)
- ⏱️ Timeout issues (network problems)
- 🗄️ Database doesn't exist

Each error type includes specific troubleshooting steps in the logs.
