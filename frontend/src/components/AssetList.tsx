import React, { useState, useEffect } from 'react';

interface Asset {
  symbol: string;
  name: string;
  price: number;
  change24h: number;
  iconUrl: string;
}

const AssetList: React.FC = () => {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Simulate asset data
    const simulateAssets = () => {
      const mockAssets: Asset[] = [
        {
          symbol: 'BTC/USDT',
          name: 'Bitcoin',
          price: 50000,
          change24h: 2.5,
          iconUrl: 'https://example.com/btc.png'
        },
        {
          symbol: 'ETH/USDT',
          name: 'Ethereum',
          price: 3500,
          change24h: -1.2,
          iconUrl: 'https://example.com/eth.png'
        },
        // Add more assets
      ];
      setAssets(mockAssets);
      setLoading(false);
    };

    simulateAssets();
  }, []);

  if (loading) {
    return <div>Loading assets...</div>;
  }

  return (
    <div className="asset-list">
      <h3>Market</h3>
      <div className="assets">
        {assets.map(asset => (
          <div key={asset.symbol} className="asset">
            <img src={asset.iconUrl} alt={asset.name} className="asset-icon" />
            <div className="asset-info">
              <div className="asset-name">{asset.name}</div>
              <div className="asset-symbol">{asset.symbol}</div>
            </div>
            <div className="asset-price">
              <div>${asset.price.toLocaleString()}</div>
              <div className={`asset-change ${asset.change24h >= 0 ? 'positive' : 'negative'}`}>
                {asset.change24h >= 0 ? '+' : ''}{asset.change24h.toFixed(2)}%
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default AssetList;
