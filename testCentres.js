// testCentres.js
// Abridged list of test centres. A full list can be scraped or found online.
// The 'name' must match what you type into the DVSA website.
// The 'id' is what the DVSA website uses in the radio button's 'value' attribute.
const testCentres = [
    { id: "532231", name: "Birmingham (Garretts Green)" },
    { id: "533445", name: "Birmingham (Kings Heath)" },
    { id: "518310", name: "Birmingham (Sutton Coldfield)" },
    { id: "537448", name: "Coventry" },
    { id: "516082", name: "Leeds" },
    { id: "527014", name: "Liverpool (Norris Green)" },
    { id: "527063", name: "Liverpool (Speke)" },
    { id: "528522", name: "London (Barking)" },
    { id: "524629", name: "London (Hendon)" },
    { id: "523820", name: "London (Morden)" },
    { id: "514521", name: "Manchester (Chadderton)" },
    { id: "514619", name: "Manchester (Sale)" },
    { id: "514691", name: "Manchester (West Didsbury)" },
    { id: "542918", name: "Sheffield (Middlewood)" }
];

module.exports = testCentres;