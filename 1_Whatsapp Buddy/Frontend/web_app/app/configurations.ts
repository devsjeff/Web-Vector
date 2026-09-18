export const Frontend_Links = {

                            Landing_Page: "/",
                            Home_page :"/Home" ,
                            Login_Page: "/Auth/Login",
                            Signup_Page: "/Auth/Signup",
                            Verify_otp : "/Auth/VerifySignOtp",
                            Forgot_password: "/Auth/ForgotPassword",
                            Application: "/Application",
};



const Backend_Home = "http://localhost:8000";

export const Backend_urls = {   Auth : `${Backend_Home}/Auth`,
                                Login: `${Backend_Home}/Auth/Login`,
                                SignupSendOTP: `${Backend_Home}/Auth/SignupSendOTP`,
                                Verify_otp_Create_Acc : `${Backend_Home}/Auth/VerifySignOtpCreateAcc`,
                                Forgot_password_Otp: `${Backend_Home}/Auth/Forgot_password_Otp`,
                                Forget_pass_Reset: `${Backend_Home}/Auth/Forget_pass_Reset`
                                
};
// 