awk '
/const \[ticketCount, setTicketCount\] = useState\(1\);/ {
    print
    print "  const [originOptions, setOriginOptions] = useState<string[]>([]);"
    print "  const [destinationOptions, setDestinationOptions] = useState<string[]>([]);"
    print ""
    print "  useEffect(() => {"
    print "    async function fetchRoutes() {"
    print "      try {"
    print "        const res = await fetch(\"http://localhost:4000/api/v1/routes\");"
    print "        if (!res.ok) return;"
    print "        const json = await res.json();"
    print "        const routes = json.data || [];"
    print "        "
    print "        const origins = new Set<string>();"
    print "        const destinations = new Set<string>();"
    print "        "
    print "        routes.forEach((route: any) => {"
    print "          if (route.origin) origins.add(route.origin);"
    print "          if (route.destination) destinations.add(route.destination);"
    print "        });"
    print "        "
    print "        setOriginOptions(Array.from(origins));"
    print "        setDestinationOptions(Array.from(destinations));"
    print "      } catch (err) {"
    print "        console.error(\"Failed to fetch routes\", err);"
    print "      }"
    print "    }"
    print "    fetchRoutes();"
    print "  }, []);"
    next
}
{ print }
' apps/web/src/features/home/components/hero-section.tsx > temp.tsx && mv temp.tsx apps/web/src/features/home/components/hero-section.tsx
