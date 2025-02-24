import json
import argparse
from openai import OpenAI

client = OpenAI(
    base_url="http://localhost:3031/",
)


def image_example():
    model_selector = json.dumps({
        "tier_selector": "<4",
        "flags": ["vision"],
    })
    response = client.chat.completions.create(
        model=model_selector,
        max_tokens=1024,
        messages=[
            {
                "role": "user",
                "content": [
                    {"type": "text", "text": "Describe what's in this image in 10 words or less."},
                    {
                        "type": "image_url",
                        "image_url": {
                            "url": "https://upload.wikimedia.org/wikipedia/commons/thumb/d/dd/Gfp-wisconsin-madison-the-nature-boardwalk.jpg/2560px-Gfp-wisconsin-madison-the-nature-boardwalk.jpg"
                        },
                    },
                ],
            }
        ],
        stream=True,
    )

    for chunk in response:
        print(chunk.choices[0].delta.content, end="", flush=True)
    print()


def tool_example():
    model_selector = json.dumps({
        "tier_selector": ">2",
        "flags": ["tool-use"],
    })
    response = client.chat.completions.create(
        model=model_selector,
        max_tokens=1024,
        messages=[
            {
                "role": "user",
                "content": "What's the weather in LA?",
            },
        ],
        tools=[
            {
                "type": "function",
                "function": {
                    "name": "get_weather",
                    "description": "Get the weather of a city",
                    "parameters": {
                        "type": "object",
                        "properties": {
                            "location": {
                                "type": "string",
                                "description": "The city and state, e.g. San Francisco, CA",
                            },
                        },
                        "required": ["location"],
                    },
                },
            },
        ],
    )
    result = response.choices[0].message
    print(result)


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--image", action="store_true", help="Run the image example")
    parser.add_argument("--tool", action="store_true", help="Run the tool example")
    args = parser.parse_args()

    if not args.image and not args.tool:
        print("No example selected. Use --image or --tool to run an example.")
        exit(1)

    if args.image:
        image_example()
    if args.tool:
        tool_example()
