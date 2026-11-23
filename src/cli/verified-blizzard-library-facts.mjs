// Owner and nonempty-document facts checked against both XML readers and the
// authored model for installed SC2 5.0.17.98745. Installed bytes are still read
// and authenticated on each job. An unfamiliar digest takes the normal parser.
const facts = [
  [
    'Base.SC2Data/TriggerLibs/NativeLib.TriggerLib',
    'cbb2302825dce57ff9bb8efd44f9b0ed5cb056eee00265e5b711b0824d872396',
    '362dad17020331a24328f34a7667be22566c93bc6d039f7f55b42ae51f8f7340',
    ['Ntve'],
  ],
  [
    'Base.SC2Data/TriggerLibs/LibertyLib.SC2Lib',
    '7164d3c4f2a549431c4c41a87113baa9698c5d4ab3c3e8f0882d18b85b5899e8',
    'fdd2d21800718fd0aab18782deec8d8d46065c3f419249dcbac33dc2a2411301',
    ['Lbty'],
  ],
  [
    'Base.SC2Data/TriggerLibs/SwarmLib.SC2Lib',
    '4b016a944e24f0743ddc230da1d41717aa49ac61e40337ed75bdd59fd957050e',
    'e9ed7816feb4f39af2ba05d4fd84a06b1ee6332c33b80aa57fa12caf577dc488',
    ['Hots'],
  ],
  [
    'Base.SC2Data/TriggerLibs/VoidLib.SC2Lib',
    '4c3eb0e3469783bf9af9dcda9c52bdf3b640fdf71beeb3f9dffac7aeb0ad8ed0',
    'ea01ec3e1ee399826c5449306d1767ec412944eae908dafeb57f0763433412b7',
    ['Lotv'],
  ],
  [
    'Base.SC2Data/TriggerLibs/VoidCampaignLib.SC2Lib',
    '6940efa6b6d069490e40a6d968491d127cf8e31fccff5b73559593ac7fc4b694',
    '80afe50c152319b5d5b44515c269aa23237a51d83b58b940f04b5b93f374b72d',
    ['VoiC'],
  ],
  [
    'Base.SC2Data/TriggerLibs/VoidCampaignMissionLib.SC2Lib',
    '43362e36825cb0a4b672386df8dc219878c8c13d5f242b6b79fab21b62a3a1b9',
    '80afe50c152319b5d5b44515c269aa23237a51d83b58b940f04b5b93f374b72d',
    ['VCMI'],
  ],
  [
    'Base.SC2Data/TriggerLibs/VoidCampaignStoryLib.SC2Lib',
    'c0adc786bbda710289dd3cd7e80e7303f49b4c5d816638179ec2096ed3f5b5f6',
    '80afe50c152319b5d5b44515c269aa23237a51d83b58b940f04b5b93f374b72d',
    ['VCST'],
  ],
  [
    'Base.SC2Data/TriggerLibs/VoidCampaignUILib.SC2Lib',
    '49ca27492cc70a0708fed0943cb6d9737189b80860104b1e2fadb27a3ebab9ef',
    '80afe50c152319b5d5b44515c269aa23237a51d83b58b940f04b5b93f374b72d',
    ['VCUI'],
  ],
  [
    'Base.SC2Data/TriggerLibs/SwarmCampaignLib.SC2Lib',
    'b373c4e50b4041738913180e5224fbd42604f401e94c402716a5843e9ebcdba2',
    '97c55cda1f432e074d30bdb820beb748520d6d19d92b6a5c39c6c8849c5adccf',
    ['SwaC'],
  ],
  [
    'Base.SC2Data/TriggerLibs/SwarmCampaignDataHelperLib.SC2Lib',
    '878524284f5af76ab1a789bfd278a2873ed0fc5152c545810d7c6553e7ef5e5a',
    '97c55cda1f432e074d30bdb820beb748520d6d19d92b6a5c39c6c8849c5adccf',
    ['SCDH'],
  ],
];

export const verifiedStockOwnersByXml = new Map(
  facts.map(([, xml, , owners]) => [xml, Object.freeze(owners)]),
);
export const verifiedStockOwnersByLocalizedDocument = new Map(
  facts.map(([file, xml, strings, owners]) => [JSON.stringify([file, xml, strings]), owners]),
);
