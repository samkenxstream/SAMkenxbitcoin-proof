const crypto = require('crypto');

var sha256 = exports.sha256 = function(data) {
  return new Buffer(crypto.createHash('sha256').update(data).digest('binary'), 'binary');
};

var twoSha256 = exports.twoSha256 = function(data) {
  return sha256(sha256(data));
};

var bufReverse = exports.bufReverse = function(buf) {
  return new Buffer(Array.prototype.slice.call(buf).reverse());
};

var getProof = exports.getProof = function(txs, index) {
  // if (txs.length == 0) {
  //   return [util.NULL_HASH.slice(0)];
  // }

  // adapted from BitcoinJ and bitcore
  var tree = txs.map(function(txStr) {
    return new Buffer(txStr, 'hex');
  });

  var j = 0;

  if (index >= 0) {
    var lookFor = txs[index].toString('hex');
    var proof = {
      txHash: txs[index],
      txIndex: index,
      sibling: []
    };
    var foundSibling = false;
  }

  // Now step through each level ...
  for (var size = txs.length; size > 1; size = Math.floor((size + 1) / 2)) {
    // and for each leaf on that level ..
    for (var i = 0; i < size; i += 2) {
      var i2 = Math.min(i + 1, size - 1);
      var a = tree[j + i];
      var b = tree[j + i2];

      if (index >= 0) {
        var aHex = a.toString('hex'),
          bHex = b.toString('hex');
// console.log('lf: ', lookFor, aHex, bHex)
        if (lookFor === aHex) {
          proof.sibling.push(bHex);
          foundSibling = true;
// console.log('pA: ', proof)
        } else if (lookFor === bHex) {
          proof.sibling.push(aHex);
          foundSibling = true;
// console.log('pB: ', proof)
        }
      }

      var dblSha = twoSha256(Buffer.concat([bufReverse(a), bufReverse(b)]));
      dblSha = bufReverse(dblSha);

      if (foundSibling) {
        lookFor = dblSha.toString('hex');
        // console.log('@@@@@@@@ ', bufReverse(a), bufReverse(b), lookFor)

        foundSibling = false;
      }

      tree.push(dblSha);
    }
    j += size;
  }

  if (index >= 0) {
    // console.log('@@@@@@@@@proof: ', proof)
    return proof;
  }

  return tree[tree.length - 1].toString('hex');
};

exports.getMerkleRoot = function(txs) {
  return getProof(txs, null);
};

exports.getTxMerkle = function(tx, proofObj) {
  var resultHash = new Buffer(tx, 'hex'),
    left,
    right,
    txIndex = proofObj.txIndex;

  proofObj.sibling.forEach(function(sibling) {
    var proofHex = new Buffer(sibling, 'hex'),
      sideOfSibling = txIndex % 2;  // 0 means sibling is on the right; 1 means left

    if (sideOfSibling === 1) {
      left = proofHex;
      right = resultHash;
    } else if (sideOfSibling === 0) {
      left = resultHash;
      right = proofHex;
    }

    resultHash = twoSha256(Buffer.concat([bufReverse(left), bufReverse(right)]));
    resultHash = bufReverse(resultHash);

    txIndex = Math.floor(txIndex / 2);
  });

  return resultHash.toString('hex');
};
