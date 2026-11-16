#include <bits/stdc++.h>
using namespace std;

// Return true if every bracket is closed by the same type in the right order.
bool solve(const string& s) {
    // TODO: write your algorithm here
    return false;
}

int main() {
    ios::sync_with_stdio(false);
    cin.tie(nullptr);
    string s;
    getline(cin, s);
    if (!s.empty() && s.back() == '\r') s.pop_back();
    cout << (solve(s) ? "true" : "false") << '\n';
    return 0;
}
