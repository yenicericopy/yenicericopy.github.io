import { useState } from "react";

function Webrtcthing() {
  const [peer, setpeer] = useState(
    new RTCPeerConnection({
      iceCandidatePoolSize: 30,
      iceServers: [
        {
          urls: ["stun.l.google.com:19302"],
        },
      ],
    })
    
  );
}
