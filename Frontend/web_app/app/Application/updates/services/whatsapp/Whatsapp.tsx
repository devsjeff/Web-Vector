import style from "./Whatsapp.module.css";
import {useEffect } from "react" ;

export default function Whatsapp() {
  useEffect(() => {
    async function getStatus(): Promise<void> {
     
    }

    void getStatus();
  }, []);

  return (
    <section className={style.container}>
      <header className={style.header}>
        <div>
          <p className={style.eyebrow}>Connected service</p>
          <h1 className={style.title}>WhatsApp</h1>
          <p className={style.description}>
            Configure WhatsApp accounts and the automation that will run through this service.
          </p>
        </div>

        <span className={style.status}>Not connected</span>
      </header>

      <div className={style.grid}>
        <article className={style.card}>
          <span className={style.cardLabel}>Account</span>
          <p className={style.cardValue}>No WhatsApp account connected</p>
          <p className={style.cardMuted}>Your account list can be added here later.</p>
        </article>

        <article className={style.card}>
          <span className={style.cardLabel}>Settings</span>
          <p className={style.cardValue}>Automation settings</p>
          <p className={style.cardMuted}>This is where your future WhatsApp controls can live.</p>
        </article>
      </div>
    </section>
  );
}
