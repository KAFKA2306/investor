import asyncio
import os
from dotenv import load_dotenv
from browser_use import Agent, Browser
from langchain_openai import ChatOpenAI

load_dotenv()

async def main():
    # 🌍 LLMの設定（.envから読み込むよっ！）
    llm = ChatOpenAI(
        model=os.getenv('OPENAI_MODEL', 'gpt-4o'),
        api_key=os.getenv('OPENAI_API_KEY'),
        base_url=os.getenv('OPENAI_BASE_URL')
    )
    # 🎀 Agentくんが provider 属性を欲しがるから、教えてあげるね！💖
    llm.provider = 'openai'

    # 🎀 Chromeさんを使う設定にするよっ！✨
    browser = Browser.from_system_chrome(
        headless=True,
        disable_security=True,
        args=[
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-gpu'
        ]
    )

    # 🤖 エージェント君に「Geminiさんに挨拶してきて！」ってお願いするの！✨
    agent = Agent(
        task="Navigate to https://gemini.google.com/. If prompted to sign in, use the existing session. Once on the chat page, type 'Hello Gemini, this is an automated verification test using browser-use. Please respond with a short greeting.' and send it. Wait for the response and tell me what Gemini said!",
        llm=llm,
        browser=browser
    )

    result = await agent.run()
    print(f"🎀 Geminiさんからのお返事だよ！: {result}")

    await browser.kill() # kill() を使ってちゃんとお片付けするね！💖

if __name__ == "__main__":
    asyncio.run(main())
