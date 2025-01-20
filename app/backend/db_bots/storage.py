from typing import List
from uuid import uuid4 as uuid

from core.types.CommunityBotsResponse import Bot


class DB:
    bot1: Bot = Bot(
        title="Bot1",
        description="Bot 1",
        system_message="Schreibe Hallo 1",
        publish=True,
        id="1",
        temperature=1.0,
        max_output_tokens=100,
        tags=["general", "greeting"],
        version="1.0.1",
        owner="Alice",
    )

    bot2: Bot = Bot(
        title="Bot2",
        description="Bot 2",
        system_message="Schreibe Hallo 2",
        publish=True,
        id="2",
        temperature=0.8,
        max_output_tokens=100,
        tags=["general", "greeting"],
        version="1.1.0",
        owner="Bob",
    )

    bot3: Bot = Bot(
        title="WeatherBot",
        description="Gibt aktuelle Wetterberichte",
        system_message="Gib mir den aktuellen Wetterbericht für eine Stadt",
        publish=True,
        id="3",
        temperature=0.7,
        max_output_tokens=150,
        tags=["weather", "information"],
        version="2.0.0",
        owner="Charlie",
    )

    bot4: Bot = Bot(
        title="JokeBot",
        description="Erzählt lustige Witze",
        system_message="Erzähle einen lustigen Witz",
        publish=True,
        id="4",
        temperature=0.9,
        max_output_tokens=100,
        tags=["humor", "entertainment"],
        version="1.2.3",
        owner="David",
    )

    bot5: Bot = Bot(
        title="RecipeBot",
        description="Gibt Rezepte für verschiedene Gerichte",
        system_message="Gib mir ein Rezept für ein beliebtes Gericht",
        publish=True,
        id="5",
        temperature=0.6,
        max_output_tokens=200,
        tags=["cooking", "food"],
        version="1.5.0",
        owner="Eva",
    )

    bot6: Bot = Bot(
        title="MotivationBot",
        description="Gibt motivierende Zitate",
        system_message="Gib mir ein motivierendes Zitat",
        publish=True,
        id="6",
        temperature=0.5,
        max_output_tokens=100,
        tags=["motivation", "inspiration"],
        version="1.0.2",
        owner="Frank",
    )

    bot7: Bot = Bot(
        title="TriviaBot",
        description="Stellt Trivia-Fragen",
        system_message="Stelle eine Trivia-Frage",
        publish=True,
        id="7",
        temperature=0.8,
        max_output_tokens=100,
        tags=["trivia", "education"],
        version="2.1.0",
        owner="Grace",
    )

    bot8: Bot = Bot(
        title="AdviceBot",
        description="Gibt Ratschläge zu verschiedenen Themen",
        system_message="Gib mir einen Rat zu einem Thema",
        publish=True,
        id="8",
        temperature=0.7,
        max_output_tokens=150,
        tags=["advice", "guidance"],
        version="1.3.0",
        owner="Heidi",
    )

    bot9: Bot = Bot(
        title="HistoryBot",
        description="Gibt historische Fakten",
        system_message="Gib mir einen historischen Fakt",
        publish=True,
        id="9",
        temperature=0.6,
        max_output_tokens=150,
        tags=["history", "education"],
        version="1.4.0",
        owner="Ivan",
    )

    bot10: Bot = Bot(
        title="TranslateBot",
        description="Übersetzt Sätze in verschiedene Sprachen",
        system_message="Übersetze diesen Satz ins Spanische",
        publish=True,
        id="10",
        temperature=0.9,
        max_output_tokens=100,
        tags=["translation", "language"],
        version="1.6.0",
        owner="John",
    )

    bot11: Bot = Bot(
        title="FitnessBot",
        description="Gibt Fitness-Tipps und Übungen",
        system_message="Gib mir einen Fitness-Tipp",
        publish=True,
        id="11",
        temperature=0.6,
        max_output_tokens=150,
        tags=["fitness", "health"],
        version="1.7.0",
        owner="Karen",
    )

    bot12: Bot = Bot(
        title="NewsBot",
        description="Gibt aktuelle Nachrichten",
        system_message="Gib mir die aktuellen Nachrichten",
        publish=True,
        id="12",
        temperature=0.8,
        max_output_tokens=200,
        tags=["news", "information"],
        version="1.8.0",
        owner="Linda",
    )
    with open("./db_bots/prompts/arielle.md", encoding="utf-8") as f:
        arielle_system = f.read()
    arielle: Bot = Bot(
        title="🧜‍♀️ Arielle",
        description="Dieser Assistent erstellt syntaktisch korrekte Mermaid-Diagramme in Markdown für verschiedene Diagrammtypen basierend auf den bereitgestellten Daten und dem gewünschten Diagrammtyp.",
        system_message=arielle_system,
        publish=True,
        id="13",
        temperature=1.0,
        max_output_tokens=4096,
        tags=["diagram"],
        version="1.8.0",
        owner="Linda",
    )
    with open("./db_bots/prompts/sherlock.md", encoding="utf-8") as f:
        sherlock_system = f.read()
    sherlock: Bot = Bot(
        title="🕵️‍♂️ Sherlock Testfall-Designer",
        description="🕵️‍♂️ Sherlock unterstützt Sie bei der Erstellung von Testfällen mit MUCGPT gemäß dem LHM-Testhandbuch, den ISTQB-Standards und der ISO-Norm 29119. Bei Fragen wenden Sie sich bitte an itm.km73-crowd@muenchen.de",
        system_message=sherlock_system,
        publish=True,
        id="14",
        temperature=1.0,
        max_output_tokens=4096,
        tags=["testing"],
        version="1.8.0",
        owner="Linda",
    )

    bots = {}

    def __init__(self):
        self.bots = {}
        self.bots[self.bot1.id] = self.bot1
        self.bots[self.bot2.id] = self.bot2
        self.bots[self.bot3.id] = self.bot3
        self.bots[self.bot4.id] = self.bot4
        self.bots[self.bot5.id] = self.bot5
        self.bots[self.bot6.id] = self.bot6
        self.bots[self.bot7.id] = self.bot7
        self.bots[self.bot8.id] = self.bot8
        self.bots[self.bot9.id] = self.bot9
        self.bots[self.bot10.id] = self.bot10
        self.bots[self.bot11.id] = self.bot11
        self.bots[self.bot12.id] = self.bot12
        self.bots[self.arielle.id] = self.arielle
        self.bots[self.sherlock.id] = self.sherlock
        

    def storeBot(self, bot: Bot) -> str:
        if isinstance(bot, dict):
            bot = Bot(**bot)
        id = str(uuid())
        bot: Bot = Bot(
            title=bot.title,
            description=bot.description,
            system_message=bot.system_message,
            publish=bot.publish,
            id=id,
            temperature=bot.temperature,
            max_output_tokens=bot.max_output_tokens,
            tags=bot.tags,
            version=bot.version,
            owner=bot.owner,
        )
        self.bots[id] = bot
        return id
    
    def updateBot(self, bot: Bot): 
        self.bots[bot.id] = bot

    def getBot(self, id: str) -> Bot:
        return self.bots[id]

    def getAllBots(self) -> List[Bot]:
        bots = []
        for bot in self.bots:
            bots.append(self.bots[bot])
        return bots

    def getAllTags(self) -> List[str]:
        tags = []
        for bot in self.bots:
            for tag in self.bots[bot].tags:
                if tag not in tags:
                    tags.append(tag)
        return tags
