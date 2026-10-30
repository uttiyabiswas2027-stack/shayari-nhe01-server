/* Original English poems written for this demo. Five moods, five two-line poems each. */
const SHAYARI = {
  lonely: {
    label: "lonely",
    hint: "when the room feels bigger than you",
    lines: [
      {l1:"The windows keep their quiet watch all night;",
       l2:"the city is vast, yet no one here is mine.",
       note:"Loneliness is a real feeling. So is being seen - and right now, you are."},
      {l1:"I told the moon it must be lonely too;",
       l2:"it said, I am - but I still share my light.",
       note:"Being alone and being generous can live in the same heart."},
      {l1:"A crowd can be the loneliest of rooms;",
       l2:"the street my heart calls home is somewhere else.",
       note:"Missing a place is a way of missing the people in it."},
      {l1:"The tear that never falls still weighs the most;",
       l2:"some griefs are carried quietly, unnamed.",
       note:"You don't have to explain it for it to be heavy."},
      {l1:"A hundred names are waiting in my phone;",
       l2:"at this late hour, not one of them is you.",
       note:"The person you want at 2 a.m. is the one this poem is about."}
    ]
  },
  hopeful: {
    label: "hopeful",
    hint: "a small light, kept on",
    lines: [
      {l1:"Morning has knocked upon the door again;",
       l2:"even the saddest night is packing up.",
       note:"Nothing about last night gets a vote on today."},
      {l1:"After the longest dark, a dawn arrives;",
       l2:"lamps that went out can learn to burn again.",
       note:"Going out is not the same as being done."},
      {l1:"One ray of hope is rationed like a feast;",
       l2:"even dry leaves are hiding a small spring.",
       note:"You need less hope than you think. A little goes far."},
      {l1:"Whatever broke in you can mend in time;",
       l2:"the hours are gentle, patient surgeons.",
       note:"Healing is slow on purpose. Let it take its time."},
      {l1:"Tomorrow's sun already bears your name;",
       l2:"today's tired hands are saving up their strength.",
       note:"Rest is not quitting. It is preparation."}
    ]
  },
  missing: {
    label: "missing someone",
    hint: "for the one who isn't here",
    lines: [
      {l1:"Your memory is louder than the night;",
       l2:"even the silence here has learned your name.",
       note:"Missing someone is love with nowhere to go. It still counts."},
      {l1:"You're far away, and somehow still near;",
       l2:"each rustle of the wind sounds like your step.",
       note:"The heart keeps its own address book."},
      {l1:"Old letters hold their fragrance after years;",
       l2:"some people leave, and never really go.",
       note:"What stays after someone leaves is also a kind of gift."},
      {l1:"Same lane, same tea stall, same evening light;",
       l2:"everything's here - except the sound of you.",
       note:"Familiar places notice absences too."},
      {l1:"The festival lights reach all the way back home;",
       l2:"I'm here, and my old chair sits empty there.",
       note:"Celebrating from a distance is still celebrating."}
    ]
  },
  calm: {
    label: "calm",
    hint: "nothing to fix right now",
    lines: [
      {l1:"Cold air, warm tea, a pocketful of quiet;",
       l2:"some evenings simply fold around themselves.",
       note:"You are allowed to enjoy a moment without earning it."},
      {l1:"Far from the noise, I ran into myself;",
       l2:"we sat a while, and neither of us spoke.",
       note:"Good company includes your own."},
      {l1:"The moonlit street has put the world on pause;",
       l2:"tonight, even time is lying down to rest.",
       note:"Stillness is not emptiness. It is the world catching its breath."},
      {l1:"Slow breath, light thoughts, an unclenched mind;",
       l2:"I want for nothing but this passing moment.",
       note:"This is the whole exercise. You're doing it."},
      {l1:"Be deep and still the way still water is;",
       l2:"the mind can smile without a single wave.",
       note:"Calm is not the absence of depth. It is depth, at rest."}
    ]
  },
  celebrating: {
    label: "celebrating",
    hint: "something went right",
    lines: [
      {l1:"Today my heart said: dance, and gave no reason;",
       l2:"happiness sometimes shows up uninvited.",
       note:"No reason is a perfectly good reason."},
      {l1:"The sweetness of the work arrives at last;",
       l2:"success is here - go on and hold it close.",
       note:"You did the work. Let yourself feel the reward."},
      {l1:"Light every lamp, set every lane aglow;",
       l2:"this day has dressed itself for celebration.",
       note:"Mark the good days. They are easier to forget than the bad ones."},
      {l1:"Friends, and laughter falling like summer rain;",
       l2:"pocket these hours - you'll spend them later.",
       note:"Joy stored is joy saved."},
      {l1:"Joy is the one thing that grows when shared;",
       l2:"go spend your laughter freely on the world.",
       note:"Pass it on. It multiplies."}
    ]
  }
};

const CHECKINS = {
  lateNight: "Up this late? The quiet hours are exactly why I'm here. Let's sit with it together.",
  evening: "Evening. The day is done - however it went, you made it through.",
  morning: "A new day. Kettle on? Let's begin gently.",
  afternoon: "Afternoons can weigh more than they should. A pause is allowed."
};
