/**
 * A simple tool that gets the weather for a given city and state.
 */

const API_KEY = ""; // TODO: Add your API key

// Define the schema for the tool. See https://platform.openai.com/docs/guides/function-calling?api-mode=chat
// for more information about how to define the schema.
export const WEATHER_TOOL = {
    type: "function",
    function: {
      name: "get_weather",
      description: "Get the weather of a city",
      parameters: JSON.stringify({
        type: "object",
        properties: {
          city: {
            type: "string",
            description: "The city, e.g. Los Angeles",
          },
          state: {
            type: "string",
            description: "The state, e.g. CA",
          },
        },
        required: ["city", "state"],
      }),
    },
  };
  

type WeatherData = {
    main: {
        temp: number;
        humidity: number;
        pressure: number;
    };
    weather: { description: string }[];
};

// A simple tool that gets the weather for a given city and state.
export async function getWeather(
    city: string,
    state: string
): Promise<WeatherData | null> {
    if (!API_KEY) {
        console.log("No API key found, returning mock data!");
        return {
            main: {
                temp: 65,
                humidity: 50,
                pressure: 1013,
            },
            weather: [{ description: "Sunny" }],
        }
    }

    const location = `${city},${state},US`;
    const url = `https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(
        location
    )}&appid=${API_KEY}&units=imperial`;

    try {
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error("City not found or API error");
        }
        const data: WeatherData = await response.json();
        return data;
    } catch (error) {
        console.error(error);
        return null;
    }
}
