import "./App.css";
import React, {createRef, useEffect, useRef, useState,} from "react";
import {QRCodeSVG} from "qrcode.react";
import "typesocket";
import * as uuid from "uuid";
import {TypeSocket} from "typesocket";
import "qr-scanner";
import {Point} from "jsqr/dist/locator";
import QrScanner from "qr-scanner";
// const peer = new RTCPeerConnection({
//   iceCandidatePoolSize: 30,
//   iceServers: [
//     {
//       urls: ["stun:stun.l.google.com:19302"],
//     },
//   ],
// });

const sleep = (time) => {
    return new Promise((resolve) => {
        setTimeout(resolve, time);
    });
};
type servervaluemodel =
    | {
    action: "yourpeer";
    mykeyforyou: string;
}
    | {
    action: "answerfromme";
    myanswer: RTCSessionDescriptionInit;
}
    | {
    action: "icecandidtefromme";
    mycandidate: RTCIceCandidate;
};

type servermsgmodel = {
    key: string;
    value: servervaluemodel;
};

interface signallingchannel {
    //buffers while connecting
    send(msg: servermsgmodel): void;

    on(event: "msg", callback: (from: string, msg: servervaluemodel) => void);
}

interface Signallingchanfacory {
    gimmenewone(): { myid: string; chan: signallingchannel };
}

class remotechan implements signallingchannel {
    ws: TypeSocket<servermsgmodel>
    id: string
    callback: ((from: string, msg: servervaluemodel) => void)

    constructor(socket, id) {
        this.ws = socket
        this.id = id
        this.ws.on("message", message => {
            this.callback(message.key, message.value)
        })

    }

    on(event: "msg", callback: (from: string, msg: servervaluemodel) => void) {
        this.callback = callback

    }

    send(msg: servermsgmodel) {
        this.ws.send(msg)
    }

}

class Remotesignaller implements Signallingchanfacory {
    ws: TypeSocket<servermsgmodel>
    serverHandle: string

    constructor() {
        this.serverHandle = "wss://yenicericopybackend.herokuapp.com/"
    }

    gimmenewone(): { myid: string; chan: signallingchannel } {
        let remoteuuid = uuid.v4()
        new TypeSocket<servermsgmodel>(this.serverHandle + remoteuuid)
        return {
            myid: remoteuuid,
            chan: new remotechan(new TypeSocket<servermsgmodel>(this.serverHandle + remoteuuid), remoteuuid)
        }

    }
}


class Peerthing {
    pc: RTCPeerConnection;
    amiestablisher: boolean;
    // msgbuf: servervaluemodel[];
    theirid: string;
    sgfactory: Signallingchanfacory;
    curchan: { myid: string; chan: signallingchannel };

    constructor(signalchanfoctory: Signallingchanfacory, cert: RTCCertificate) {
        this.sgfactory = signalchanfoctory;
        this.curchan = this.sgfactory.gimmenewone();
        this.pc = new RTCPeerConnection({
            iceServers: [
                {
                    urls: ["stun:stun.l.google.com:19302"],
                },
            ],
            iceCandidatePoolSize: 128,
            certificates: [cert],
        });
    }

    // create ofer and set local descrpiton
    // get answer and set it remote answer
    // add event handler for icecanidate negotiationneeded
    async Sendoffer(): Promise<[offer: RTCSessionDescriptionInit, localis: string]> {

        let chanholder = this.sgfactory.gimmenewone();
        this.curchan.myid = chanholder.myid;
        this.curchan.chan = chanholder.chan;
        let offer = await this.pc.createOffer().then((offer) => {
            this.pc.setLocalDescription(offer);
            return offer;
        });
        this.curchan.chan.on("msg", (from, frommsg) => {
            switch (frommsg.action) {
                case "yourpeer":
                    this.amiestablisher = true;
                    this.theirid = frommsg.mykeyforyou;
                    this.pc.addEventListener("negotiationneeded", async (ev) => {
                        this.pc.addEventListener("icecandidate", (ev) => {
                            this.curchan.chan.send({
                                key: this.theirid,
                                value: {
                                    action: "icecandidtefromme",
                                    mycandidate: ev.candidate!,
                                },
                            });
                        });


                    })
                    break;
                case "answerfromme":
                    this.pc.setRemoteDescription(frommsg.myanswer);
                    this.pc.addEventListener("icecandidate", (ev) => {
                        this.curchan.chan.send({
                            key: this.theirid,
                            value: {
                                action: "icecandidtefromme",
                                mycandidate: ev.candidate!,
                            },
                        });
                    });
                    break;
                case "icecandidtefromme":
                    this.pc.addIceCandidate(frommsg.mycandidate);
            }
        });

        return [offer, this.curchan.myid];
    }

    async Gotoffer(offer: RTCSessionDescriptionInit, remoteid: string) {

        let chanholder = this.sgfactory.gimmenewone();
        this.curchan.myid = chanholder.myid;
        this.curchan.chan = chanholder.chan;
        await this.pc.setRemoteDescription(new RTCSessionDescription(offer));
        this.pc.addEventListener("negotiationneeded", async (ev) => {
            await this.pc.setRemoteDescription(new RTCSessionDescription(offer));

            // let answer = await this.pc.createAnswer();
            // await this.pc.setLocalDescription(answer);
            // this.curchan.chan.send({
            //     key: remoteid,
            //     value: {
            //         action: "yourpeer",
            //         mykeyforyou: this.curchan.myid,
            //     },
            // });
            // this.curchan.chan.send({
            //     key: remoteid,
            //     value: {
            //         action: "answerfromme",
            //         myanswer: this.pc.localDescription!,
            //     },
            // });
            this.pc.addEventListener("icecandidate", (candidate) => {
                if (candidate.candidate) {
                    this.curchan.chan.send({
                        key: remoteid,
                        value: {
                            action: "icecandidtefromme",
                            mycandidate: candidate.candidate,
                        },
                    });
                }
            });
        });

        let answer = await this.pc.createAnswer();
        await this.pc.setLocalDescription(answer);
        this.curchan.chan.send({
            key: remoteid,
            value: {
                action: "yourpeer",
                mykeyforyou: this.curchan.myid,
            },
        });
        this.curchan.chan.send({
            key: remoteid,
            value: {
                action: "answerfromme",
                myanswer: answer,
            },
        });
        this.curchan.chan.on("msg", (from, msg) => {
            switch (msg.action) {
                case "icecandidtefromme":
                    this.pc.addIceCandidate(msg.mycandidate)
                    break
            }
        })
    }
}

function Superfunc(): JSX.Element {

    const Masterpeer = useRef({}) as React.MutableRefObject<Peerthing>
    const [change, setchange] = useState("")
    const [Msg, setMsg] = useState<msglist>({
        msgs: [{content: "starteer", side: "center", uuid: uuid.v4()}],
    });
    // const useComponentDidMount = () => {
    //     const [ref, setref] = useRef();
    //     useEffect(() => {
    //         ref.current = true;
    //     }, []);
    //     return ref.current;
    // };
    const Meincan = useRef() as React.RefObject<HTMLCanvasElement>;


    useEffect(() => {
        let wsuuid = uuid.v4();
        console.log("new uuid");

            console.log("come here")
            RTCPeerConnection.generateCertificate({
                name: "ECDSA",
                namedCurve: "P-256"
            }).then((cert) => {
                Masterpeer.current = new Peerthing(new Remotesignaller(), cert!)
            }).then(() => {

                console.log("run")
                setchange("a")

            }).catch((eroor) => {
                console.log(eroor)
            })


        navigator.mediaDevices.getUserMedia({video: true}).then(async (medis) => {
            let vido = document.createElement("video");
            vido.srcObject = medis;
            await vido.play();
            let oldarea: { x: number; y: number }[] | null = [
                {x: 0, y: 0},
                {x: 0, y: 0},
                {x: 0, y: 0},
                {x: 0, y: 0},
            ];
            let qrengine = await QrScanner.createQrEngine();
            // let qrmaster = new QrScanner(
            //   vido,
            //   (str) => {
            //     console.log(str.data);

            //   },
            //   {}
            // );
            // qrmaster.
            let canvasctx = Meincan.current?.getContext("2d");
            let funnky = () => {
                if (!(vido.videoWidth === 0 || vido.videoHeight === 0)) {
                    if (Meincan.current === null) {
                        console.log("meincan null");
                    }
                    Meincan.current!.height = vido.videoHeight;
                    Meincan.current!.width = vido.videoWidth;

                    let drawLine = (
                        canvasctx: CanvasRenderingContext2D,
                        startpoint: Point,
                        endpoint: Point,
                        color: string
                    ) => {
                        canvasctx.beginPath();
                        canvasctx.moveTo(startpoint.x, startpoint.y);
                        canvasctx.lineTo(endpoint.x, endpoint.y);
                        canvasctx.lineWidth = 4;
                        canvasctx.strokeStyle = color;
                        canvasctx.stroke();
                    };
                    // Canvas.current!.style.height = String(vido.videoWidth);
                    // Canvas.current!.style.width = String(vido.videoHeight);
                    // console.log(vido.videoHeight);

                    canvasctx?.drawImage(vido, 0, 0, vido.videoWidth, vido.videoHeight);
                    // console.log("render area");
                    // console.log(oldarea);
                    // canvasctx!.fillStyle = "#00FF00";
                    // console.log(Meincan.current?.width);
                    // canvasctx?.fillRect(oldarea[0].x, oldarea[0].y, 5, 5);
                    // console.log("render area end");
                    QrScanner.scanImage(vido, {
                        returnDetailedScanResult: true,
                        qrEngine: qrengine,
                        // disallowCanvasResizing: true,
                    })
                        .then((value) => {
                            // console.log(value.data, value.cornerPoints);
                            // canvasctx?.fillRect(0, 0, 100, 100);

                            oldarea = value.cornerPoints;
                            // drawLine(
                            //   canvasctx!,
                            //   value.cornerPoints[0],
                            //   value.cornerPoints[1],
                            //   "#FF3B58"
                            // );
                            // drawLine(
                            //   canvasctx!,
                            //   value.cornerPoints[1],
                            //   value.cornerPoints[2],
                            //   "#FF3B58"
                            // );
                            // drawLine(
                            //   canvasctx!,
                            //   value.cornerPoints[2],
                            //   value.cornerPoints[3],
                            //   "#FF3B58"
                            // );
                            // drawLine(
                            //   canvasctx!,
                            //   value.cornerPoints[3],
                            //   value.cornerPoints[0],
                            //   "#FF3B58"
                            // );
                        })
                        .catch(() => {
                            oldarea = null;
                        });
                    // console.log(vido.videoHeight, vido.videoWidth);
                    // let qrman = jsQR(
                    //   canvasctx!.getImageData(
                    //     0,
                    //     0,
                    //     Meincan.current!.width,
                    //     Meincan.current!.height
                    //   ).data,
                    //   vido.videoWidth,
                    //   vido.videoHeight
                    // );
                    // if (qrman !== null) {
                    //   console.log(qrman);
                    // drawLine(canvasctx!, qrman.location.topLeftCorner,qrman.location.topRightCorner,"#FF3B58");
                    // drawLine(canvasctx!, qrman.location.topLeftCorner,qrman.location.bottomLeftCorner,"#FF3B58");
                    // drawLine(canvasctx!, qrman.location.bottomRightCorner,qrman.location.topRightCorner,"#FF3B58");
                    // drawLine(canvasctx!, qrman.location.bottomRightCorner,qrman.location.bottomLeftCorner,"#FF3B58");
                    // }
                    if (!(oldarea === null)) {
                        drawLine(canvasctx!, oldarea[0], oldarea[1], "#FF3B58");
                        drawLine(canvasctx!, oldarea[1], oldarea[2], "#FF3B58");
                        drawLine(canvasctx!, oldarea[2], oldarea[3], "#FF3B58");
                        drawLine(canvasctx!, oldarea[3], oldarea[0], "#FF3B58");
                    }
                    // console.log("render");
                    requestAnimationFrame(funnky);
                    // Videoelm.current?.
                } else {
                    console.log("empty video");
                    requestAnimationFrame(funnky);
                }
            };
            requestAnimationFrame(funnky);
            // Videoelm.current?.
        });


    }, []);
    useEffect(() => {
        console.log("dedi")
        if (Masterpeer.current.pc != undefined) {

            console.log("dedieffect", Masterpeer)
            Masterpeer.current.pc.addEventListener("datachannel", (that) => {
                that.channel.addEventListener("message", (ev) => {
                    setMsg({
                        msgs: [...Msg.msgs, {content: ev.data, side: "center", uuid: uuid.v4()}]

                    })
                })
            })
        }
    }, [change])
    console.log(typeof Msg.msgs);
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
                        // Peeroffer,
                        ...Msg.msgs,
                    ]}
                ></Chatelem>
                {/* <AwesomeQRCode options={{text:"a"}}></AwesomeQRCode> */}
                <div
                    style={{
                        display: "flex",
                        flexDirection: "column",
                        flex: 1,
                        flexShrink: 0,
                        flexGrow: 2,
                        height: `100%`,
                        justifyContent: "space-around",
                    }}
                >
                    <div style={{margin: "1em 0", minHeight: "0", flex: "1 1 0px"}}>
                        <canvas ref={Meincan} className="vid"></canvas>
                    </div>
                    <QRCodeSVG
                        includeMargin={true}
                        value={"meow"}
                        className="qr"
                    ></QRCodeSVG>
                </div>
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
    // [x: string]: any;
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

//
// function Rtcthing() {
//     const [a, seta] = useState("a");
//
//     useEffect(() => {
//         peer.createOffer().then((init) => {
//             console.log(init);
//             console.log(JSON.stringify(init));
//             seta(JSON.stringify(init));
//         });
//     }, []);
//     return <div>{a}</div>;
// }

function Topbar() {
    return (
        <div className="topbar">
            <a
                href="https://patotoland.com"
                className="topbarclick topbatleftmost anchorcheck"
            >
                patotoland
            </a>
            <div className="topbarclick ">contact</div>
        </div>
    );
}

// class Rtcthing extends React.Component {}

export default Superfunc;
