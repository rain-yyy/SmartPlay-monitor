
const request = require('request'); 

request({
    url: 'https://www.smartplay.lcsd.gov.hk/facilities/home',
    proxy: 'http://cswdzpyn-HK-1:qt5d1bxkin0h@p.webshare.io:80'
}, function(error, response, body) {
    if (error) {
        console.error(error);
    } else {
        console.log(body);
    }
});
