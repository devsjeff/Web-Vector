import secrets

def Generate_Otp():
    return str(secrets.randbelow(900000) + 100000)