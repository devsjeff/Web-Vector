const Home = "http://127.0.0.1:8000/"
export const Backend_urls = {url:Home , 
                            HomeAuth :Home+"Auth" ,
                            Login_Auth : Home + "Auth/Login" ,
                            Signup_Auth : Home + "Auth/Signup" ,
                            Forgot_password : Home +"Auth/ForgotPassword",
                            Application : Home + "Auth/Application" ,
                            Signup_OTP : Home + "Auth/SignupOTP"

}

const Frontend_Home = "http://localhost:3000/"
export const Frontend_Links = {Landing_Page : Frontend_Home,
                                Login_Page : Frontend_Home + "Auth/Login" ,
                                Signup_Page : Frontend_Home + "Auth/Signup" ,
                                Forgot_password : Frontend_Home +"Auth/ForgotPassword",
                                Application : Frontend_Home + "Auth/Application" 

}