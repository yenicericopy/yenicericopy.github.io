import "./App.css";
import React, { useEffect, useState } from "react";
import { v4 as uuidv4 } from "uuid";
// const peer = new RTCPeerConnection({
//   iceCandidatePoolSize: 30,
//   iceServers: [
//     {
//       urls: ["stun:stun.l.google.com:19302"],
//     },
//   ],
// });

function App(): JSX.Element {
  const [Peeroffer, setPeeroffer] = useState({} as msg);
  // useEffect(() => {
  //   peer.createOffer().then((init) => {
  //     setPeeroffer({
  //       uuid: uuidv4(),
  //       content: JSON.stringify(init),
  //       side: "center",
  //     } as msg);
  //   });
  // }, []);
  return (
    <div className="App">
      <Topbar></Topbar>
      <div className="tryheight">
        <Chatelem
          msgs={[
            {
              uuid: "c",
              content: "left",
              side: "left",
            },
            {
              uuid: "b",
              content: "right",
              side: "right",
            },
            {
              uuid: "a",
              content: "center",
              side: "center",
            },
            {
              uuid: "heybro",
              content: "hey bro",
              side: "right",
            },
            Peeroffer,
          ]}
        ></Chatelem>
        <div className="qr"></div>
      </div>
    </div>
  );
}

class Square extends React.Component {
  props: Readonly<{
    a: string;
    b: string;
    seta: React.Dispatch<React.SetStateAction<string>>;
    setb: React.Dispatch<React.SetStateAction<string>>;
  }>;

  // constructor(props) {
  //   super(props);
  //   // this.state = { a: "a", b: "b" };
  //   // this.handleclick.bind(this.handleclick);
  // }
  // handleclick() {
  //   this.setState({ a: this.state.a + "a" });
  //   this.setState({ b: this.state.b + "b" });
  //   console.log("hey");
  // }
  render(): JSX.Element {
    return (
      <button
        className="patotorender"
        onClick={(): void => {
          this.props.seta(this.props.a + "a");
          this.props.setb(this.props.b + "b");
        }}
      >
        {this.props.a + this.props.b}
      </button>
    );
  }
}

type msg = {
  uuid: string;
  content: string;
  side: "left" | "right" | "center";
};

type msglist = {
  msgs: msg[];
};

function Chatelem(props: msglist): JSX.Element {
  // let rendered: JSX.Element[] = [];
  // for (let index = 0; index < props.msgs.length; index++) {
  //   const element = props.msgs[index];
  //   rendered.push(
  //     <div className="outterbox" key={element.uuid}>
  //       <div className={element.side} key={element.uuid + "a"}>
  //         {element.content}
  //       </div>
  //     </div>
  //   );
  // }
  return (
    <div className="chatbox" key="as">
      {props.msgs.map((element, index) => {
        return (
          <div className="outterbox" key={index}>
            <div className={element.side}>{element.content}</div>
          </div>
        );
      })}
    </div>
  );
}

function Rtcthing() {
  const [a, seta] = useState("a");

  useEffect(() => {
    peer.createOffer().then((init) => {
      console.log(init);
      console.log(JSON.stringify(init));
      seta(JSON.stringify(init));
    });
  }, []);
  return <div>{a}</div>;
}

function Topbar() {
  return (
    <div className="topbar">
      <a
        href="patotoland.com"
        className="topbarclick topbatleftmost anchorcheck"
      >
        patotoland
      </a>
      <div className="topbarclick ">contact</div>
    </div>
  );
}

// class Rtcthing extends React.Component {}

export default App;
