

import React from "react";
import { getAddress, signMessage } from "sats-connect";
import "./MacBookPro163.css";


class Dashboard extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      paymentAddress: "",
      paymentPublicKey: "",
      ordinalsAddress: "",
      ordinalsPublicKey: "",
      receiptAddress: "",
      amount: "",
      balance: "",
      btcRate: null,
      btcValue: null,
      zkbtValue: null,
      swapAmount: 1,
      btcBalance: "",
      amount2: 0,
      quoteID: ""
    };
    this.balanceInterval = null; // Initialize balance interval
    this.getQuote = this.getQuote.bind(this);
  }

  
  componentDidMount() {
    this.quoteCounter = 0; // 用于跟踪报价刷新的计数器
  
    // 每1分钟更新BTC余额和报价，但仅当页面处于焦点状态时
    this.balanceInterval = setInterval(() => {
      if (document.visibilityState === 'visible') {
        if (this.quoteCounter % 20 === 0) {
          this.fetchBTCSum(this.state.ordinalsAddress);
          this.getQuote();
        }
        this.quoteCounter++;
      }
    }, 3000);
  
    // 监听visibilitychange事件，页面重新聚焦时立即更新
    document.addEventListener('visibilitychange', this.handleVisibilityChange);
  }
  
  handleVisibilityChange = () => {
    if (document.visibilityState === 'visible') {
      this.fetchBTCSum(this.state.ordinalsAddress);
      this.getQuote();
    }
  }
  
  componentWillUnmount() {
    clearInterval(this.balanceInterval);
    document.removeEventListener('visibilitychange', this.handleVisibilityChange);
  }

  async getQuote() {
    const { swapAmount } = this.state;
    const response = await fetch("http://localhost:8000/quote", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        tick1: "zkbt",
        tick2: "fast",
        contractAddress1: "tb1pam7razjc7647hthazkqzlycm78hr2ety0cxqaktc3suywm03x56s8y4hmg",
        contractAddress2: "tb1phvax6ecszcyp34txjy9h0k2cflyk9c0ue66p894vxddzjsf4uu8ssdu9pa",
        amount1: swapAmount,
      }),
    });
    const data = await response.json();
    this.setState({ amount2: data.amount2, quoteID: data.id });
  }
  

  handleSwapAmountChange = (e) => {
    const swapAmount = e.target.value;
  
    this.setState({ swapAmount }, () => {
      // Get new quote after setting state
      this.getQuote();
    });
  };


  fetchBTCRate = async () => {
    const apiKey = "6097ECCC-363E-4CE6-9F5C-308C1BC69174";
    await fetch("https://rest.coinapi.io/v1/exchangerate/BTC/USD", {
      method: "GET",
      headers: {
        "X-CoinAPI-Key": apiKey,
      },
    })
      .then((response) => response.json())
      .then((data) => {
        const btcRate = data.rate;
        const btcValue = this.state.btcBalance * btcRate; // Calculate BTC value
        const zkbtValue = (this.state.balance * btcRate) / 10000; // Calculate zkbt value
        this.setState({ btcRate, btcValue, zkbtValue });
      })
      .catch((error) => {
        console.error("Error:", error);
      });
  };


  fetchBTCSum = async (ordinalsAddress) => {
    // Fetch the balance from the specified API
    await fetch(`https://mempool.space/testnet/api/address/${ordinalsAddress}`)
      .then(response => response.json())
      .then(data => {
        const btcBalance = (data.chain_stats.funded_txo_sum + data.mempool_stats.funded_txo_sum) / 100000000; // Converting satoshis to BTC
        this.setState({ btcBalance });
      })
      .catch((error) => {
        console.error('Error:', error);
      });
  }

  fetchBalance = async (ordinalsAddress) => {
    // Fetch the balance
    await fetch("http://209.141.49.238:5000/balance", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ address: ordinalsAddress }),
    })
      .then(response => response.json())
      .then(data => this.setState({ balance: data.balance }))
      .catch((error) => {
        console.error('Error:', error);
      });
  }

  onConnectClick = async () => {
    const getAddressOptions = {
      payload: {
        purposes: ["ordinals", "payment"],
        message: "Address for receiving Ordinals",
        network: {
          type: "Testnet",
        },
      },
      onFinish: async (response) => {
        const ordinalsAddress = response.addresses[0].address;
        this.setState({
          ordinalsAddress: ordinalsAddress,
          paymentAddress: response.addresses[1].address,
          ordinalsPublicKey: response.addresses[0].publicKey,
          paymentPublicKey: response.addresses[1].publicKey,
        });

        this.fetchBalance(ordinalsAddress);
        // Fetch the BTC sum for the ordinalsAddress
        this.fetchBTCSum(ordinalsAddress);
        this.fetchBTCRate(); // Fetch BTC rate
      },

      onCancel: () => alert("Request canceled"),
    };
    await getAddress(getAddressOptions);
  };

  handleSwapClick = async () => {
    const { ordinalsAddress, swapAmount, quoteID } = this.state;
    const amount1 = swapAmount; // Amount entered by the user for swap
    const amount2 = amount1; // Same as amount1
    const tick1 = "zkbt";
    const tick2 = "fast";
    const expiry = new Date(new Date().getTime() + 1 * 60000).toISOString(); // Current time + 1 minute
    const contractAddress1 = "tb1pam7razjc7647hthazkqzlycm78hr2ety0cxqaktc3suywm03x56s8y4hmg";
    const contractAddress2 = "tb1phvax6ecszcyp34txjy9h0k2cflyk9c0ue66p894vxddzjsf4uu8ssdu9pa"; 

    const messageObj = {
      method: "swap",
      quoteID: quoteID, // 加入quoteID
      expiry: expiry,
      tick1: tick1,
      contractAddress1: contractAddress1,
      amount1: amount1,
      tick2: tick2,
      contractAddress2: contractAddress2,
      amount2: amount2,
      makerAddr: ordinalsAddress, 
      takerAddr: "", 
      // makerSig  and takerSig will be added later 
    };
    

    const signMessageOptions = {
      payload: {
        network: {
          type: "Testnet",
        },
        address: ordinalsAddress,
        message: JSON.stringify(messageObj),
      },
      onFinish: (response) => {
        messageObj.makerSig = response; // Embed the signature into the JSON
        this.onSwapMessageClick(messageObj); // Sending the signed message
      },
      onCancel: () => alert("Swap canceled"),
    };

    await signMessage(signMessageOptions);
  };

  onSwapMessageClick = async (signedMessage) => {
    // Make a HTTP POST request to the specified endpoint
    await fetch("http://0.0.0.0:8000/swap_make", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(signedMessage),
    })
      .then(response => response.json())
      .then(data => {
        alert(JSON.stringify(data));
      })
      .catch((error) => {
        console.error('Error:', error);
      });
  };

  onSignAndSendMessageClick = async () => {
    const { ordinalsAddress, receiptAddress, amount } = this.state;
    const messageObj = {
      method: "transfer",
      sAddr: ordinalsAddress,
      rAddr: receiptAddress,
      amt: amount,
      tick: "fast",
      sig: ""
    };
    const signMessageOptions = {
      payload: {
        network: {
          type: "Testnet",
        },
        address: ordinalsAddress,
        message: JSON.stringify(messageObj),
      },
      onFinish: (response) => {
        messageObj.sig = response;
        this.onSendMessageClick(messageObj);
      },
      onCancel: () => alert("Canceled"),
    };
    await signMessage(signMessageOptions);
    // Fetch the balance for the existing method (if needed)
    this.fetchBalance(ordinalsAddress);

    // Fetch the BTC sum for the ordinalsAddress
    this.fetchBTCSum(ordinalsAddress);
    this.fetchBTCRate(); // Fetch BTC rate

  }

  onSendMessageClick = async (signedMessage) => {
    // Make a HTTP POST request
    await fetch("http://192.168.254.12:5000/transfer", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(signedMessage),
    })
      .then(response => response.json())
      .then(data => {
        alert(JSON.stringify(data));
        this.fetchBalance(this.state.ordinalsAddress);
      })
      .catch((error) => {
        console.error('Error:', error);
      });
  }

  render() {
    const { btcValue, zkbtValue, ordinalsAddress } = this.state;
    const totalValue = (btcValue || 0) + (zkbtValue || 0); // Add the two values
    const amount2 = parseFloat(this.state.amount2);
    const displayAmount2 = amount2.toFixed(0); 
    return (
      <div className="macbook-pro-16-3">
        <div className="home-page-wrapper">
          <div className="home-page">
            <img className="background-icon" alt="" src="/background.svg" />
            <img className="background-icon1" alt="" src="/background1.svg" />
            <img className="home-page-child" alt="" src="/group-35.svg" />
            <div className="no-background-removebg-preview" />
            <div className="background" />
            <div className="background" />
            <div className="home-page-inner">
              <div className="frame-wrapper">
                <div className="frame-container">
                  <div className="ellipse-parent">
                    <img
                      className="frame-child"
                      alt=""
                      src="/ellipse-26@2x.png"
                    />
                    <div className="frame-wrapper">
                      <div className="logo">
                        <b className="bison-labs">{`Bison Labs `}</b>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <div className="active-menu" />
            <div className="action-menu-parent">
              <img className="action-menu" alt="" src="/action--menu.svg" />
              <div className="group-child" />
              <div className="frame" />
              <div className="group-item" />
              <div className="table">
                <div className="frame-parent">
                  <div className="portfolio-positions-wrapper">
                    <div className="portfolio-positions">{`Portfolio Positions `}</div>
                  </div>
                  <div className="send" />
                  <div className="search-2-line-parent">
                    <img
                      className="search-2-line-icon"
                      alt=""
                      src="/search2line.svg"
                    />
                    <div className="portfolio-positions">{`Search for Token `}</div>
                  </div>
                </div>
              </div>
              <div className="group-inner" />
              <div className="swap-parent">
                <div className="swap">Swap</div>
                <div className="frame-group">
                  <div className="frame-div">
                    <div className="zkbt-parent">
                      <input
                        type="number"
                        className="zkbtInputbox"
                        value={this.state.swapAmount}
                        onChange={this.handleSwapAmountChange}
                      />
                      <div className="zkbt-group">
                        <div className="zkbt1">zkbt</div>
                        <img
                          className="iconlylightarrow-down-2"
                          alt=""
                          src="/iconlylightarrow--down-2.svg"
                        />
                      </div>
                    </div>
                    <div className="btc-parent">
                      <div className="btc">{displayAmount2}</div>
                      <div className="btc-group">
                        <div className="zkbt1">fast</div>
                        <img
                          className="iconlylightarrow-down-2"
                          alt=""
                          src="/iconlylightarrow--down-2.svg"
                        />
                      </div>
                    </div>

                  </div>
                  <div className="connect-wallet-wrapper">
                    <button className="swapbutton" onClick={this.handleSwapClick}>
                      Swap
                    </button>
                  </div>
                </div>
              </div>


              <div className="group-div">
                <div className="quick-transfer-parent">
                  <div className="quick-transfer">Quick Transfer</div>
                  <div className="frame-parent1">
                    <div className="address-trevorbtc-wrapper">
                      <input
                        type="text"
                        className="address-trevorbtc"
                        value={this.state.receiptAddress}
                        onChange={(e) => this.setState({ receiptAddress: e.target.value })}
                        placeholder="Address"
                      />
                    </div>
                    <div className="amount-69-parent">
                      <input
                        type="number"
                        className="amount-69"
                        value={this.state.amount}
                        onChange={(e) => this.setState({ amount: e.target.value })}
                        placeholder="Amount"
                      />
                      <div className="zkbt-container">
                        <div className="zkbt1">zkbt</div>
                        <img
                          className="iconlylightarrow-down-2"
                          alt=""
                          src="/iconlylightarrow--down-2.svg"
                        />
                      </div>
                    </div>
                    <div className="text">{`         `}</div>
                  </div>
                  <div className="send-parent">
                    <div className="send" />
                    <img
                      className="iconlylight-outlinesend"
                      alt=""
                      src="/iconlylight-outlinesend.svg"
                    />
                    <button
                      className="transfer-now"
                      onClick={this.onSignAndSendMessageClick}
                    >         Transfer Now
                    </button>
                  </div>
                </div>
              </div>



              <div className="nav-bar">
                <div className="my-order-wrapper">
                  <div className="my-order">Network Overview</div>
                </div>
                <div className="wallet">Wallet</div>
                <div className="news-wrapper">
                  <div className="news">
                    <div className="see-more" />
                  </div>
                </div>
              </div>
              <div className="rectangle-parent">
                <div className="rectangle-div" onClick={this.onConnectClick} />
                <div className="connect-wallet1" >{`       Connect Wallet `}</div>
              </div>
              <div className="wallet-line">
                <img className="vector-icon" alt="" src="/vector.svg" />
              </div>
              <div className="balance">Balance</div>
              <div className="div">{totalValue ? `$${totalValue.toFixed(2)}` : 'Loading...'}</div>
              <div className="col-02-parent">
                <div className="col-02">
                  <div className="table-item">
                    <div className="name">#</div>
                  </div>
                  <div className="table-item1">
                    <div className="my-order">1</div>
                  </div>
                  <div className="table-item2">
                    <div className="my-order">2</div>
                  </div>
                  <div className="table-item2">
                    <div className="my-order">3</div>
                  </div>
                </div>
                <div className="col-021">
                  <div className="table-item4">
                    <div className="name">Name</div>
                  </div>
                  <div className="table-item5">
                    <img className="image-1-icon" alt="" src="/image-1@2x.png" />
                    <div className="bitcoin-wrapper">
                      <div className="portfolio-positions">Bitcoin</div>
                    </div>
                  </div>
                  <div className="table-item5">
                    <img
                      className="table-item-child"
                      alt=""
                      src="/ellipse-261@2x.png"
                    />
                    <div className="bitcoin-wrapper">
                      <div className="portfolio-positions">Bison</div>
                    </div>
                  </div>
                  <div className="table-item5">
                    <img
                      className="image-22-icon"
                      alt=""
                      src="/image-22@2x.png"
                    />
                    <div className="bitcoin-wrapper">
                      <div className="portfolio-positions">zkbt</div>
                    </div>
                  </div>
                </div>
                <div className="col-05">
                  <div className="table-item4">
                    <div className="portfolio-positions">
                      <span className="balance2">Balance</span>
                      <span className="span1">{` `}</span>
                    </div>
                  </div>
                  <div className="table-item9">
                    <div className="portfolio-positions">{this.state.btcBalance} btc</div>
                  </div>
                  <div className="table-item9">
                    <div className="portfolio-positions">0 Bison</div>
                  </div>
                  <div className="table-item9">
                    <div className="portfolio-positions">{this.state.balance} zkbt</div>
                  </div>
                </div>
                <div className="col-051">
                  <div className="table-item4">
                    <div className="portfolio-positions">
                      <span className="balance2">Balance</span>
                      <span className="span1">{` `}</span>
                    </div>
                  </div>
                  <div className="table-item9">
                  <div className="portfolio-positions">{this.state.btcBalance ? `${this.state.btcBalance} btc` : '0 btc'}</div>
                  </div>
                  <div className="table-item9">
                    <div className="portfolio-positions">0 Bison</div>
                  </div>
                  <div className="table-item9">
                    <div className="portfolio-positions">{this.state.balance ? `${this.state.balance} zkbt` : '0 zkbt'}</div>
                  </div>

                </div>
              </div>
              <div className="sub-menu">
                <div className="swap-wrapper">
                  <div className="my-order">Swap</div>
                </div>
                <div className="swap-wrapper">
                  <div className="send2">Send</div>
                </div>
                <div className="swap-wrapper">
                  <div className="my-order">Bridge</div>
                </div>
              </div>
              <img className="bisonlogo-icon" alt="" src="/bisonlogo@2x.png" />
            </div>
            <div className="col-052">
              <div className="table-item16">
                <div className="portfolio-positions">
                  <span className="balance2">Value</span>
                  <span className="span1">{` `}</span>
                </div>
              </div>
              <div className="table-item17">
                <div className="portfolio-positions">{btcValue !== null ? `$${btcValue.toFixed(2)}` : 'Loading...'}</div>
              </div>

              <div className="table-item18">
                 <div className="portfolio-positions">{this.state.paymentAddress ? '$0.00' : 'Loading...'}</div>
              </div>
              <div className="table-item19">
              <div className="portfolio-positions">{zkbtValue ? `$${zkbtValue.toFixed(2)}` : 'Loading...'}</div>
              </div>

            </div>
          </div>
        </div>
      </div>

    );
  };

}

export default Dashboard;
