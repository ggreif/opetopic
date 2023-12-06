
/^ *$/ { next }

/@()/ { next }

/<svg/ { seen = 1 }

seen { print }
