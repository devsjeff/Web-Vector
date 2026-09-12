import secrets

def Generate_Otp():
    return str(secrets.randbelow(800000)+100000)