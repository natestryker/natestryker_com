// Only fields needed for search, statistics, records and history summaries.
// Full player details and challenge data stay in the immutable match archive.
export const INDEX_COLUMNS=['accountId','id','date','duration','queue','gameMode','champion','championId','role','win','remake','kills','deaths','assists','kda','cs','csPerMinute','damage','gold','vision','pentaKills','items','killParticipation','detailHash','largestMultiKill'];
