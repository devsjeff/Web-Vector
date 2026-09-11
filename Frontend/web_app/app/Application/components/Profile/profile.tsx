"use client" ;

import { useState, useEffect, useRef, type RefObject } from "react";

import style from "./Profile.module.css";
import Image from "next/image";
import User from "../utility/Images/App_home/user.png";




function Profile_Card({ cardRef }: { cardRef: RefObject<HTMLDivElement | null> }){
return (
<div ref={cardRef} className={style.profile_card}>

  {/* Top section */}
  <div className={style.profile_top}> <Image src={User}alt="User"className={style.profile_image}/>

    <div>
      <h3>Profile</h3>
      <p>example@gmail.com</p>
    </div>
  </div>

  {/* Menu */}
  <div className={style.menu}>

    <div className={style.menu_item}>
      Upgrade
    </div>

    <div className={style.menu_item}>
      Profile
    </div>

    <div className={style.menu_item}>
      Settings
    </div>

    <div className={style.menu_item}>
      Help
    </div>

    <div className={style.menu_item}>
      Logout
    </div>

  </div>

</div>)
}






export default function Profile() {
    const [show , setShow] = useState(false)
    const cardRef = useRef<HTMLDivElement>(null);

useEffect(() => {
  function handleClickOutside(event: MouseEvent) {
    if (cardRef.current && event.target instanceof Node && !cardRef.current.contains(event.target)) {
      setShow(false);
    }
  }

  document.addEventListener("mousedown", handleClickOutside);

  return () => {
    document.removeEventListener("mousedown", handleClickOutside);
  };
}, []);

    return (

     <>
     
     
         <div className={style.Profile_container}>
             <button type="button" className={style.trigger} onClick={() => setShow(!show)} aria-expanded={show} aria-label="Open profile menu"><Image src={User} alt="User" width={40} height={40} /></button>
            {show && <Profile_Card cardRef={cardRef} />}
         </div>
     
     </>
    )
}


