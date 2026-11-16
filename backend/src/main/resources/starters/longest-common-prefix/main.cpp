#include <bits/stdc++.h>
using namespace std;

// Return the longest prefix shared by every word (possibly "").
string solve(const vector<string>& words) {
    // TODO: write your algorithm here
    return "";
}

int main() {
    ios::sync_with_stdio(false);
    cin.tie(nullptr);
    string line;
    getline(cin, line);
    int n = stoi(line);
    vector<string> words(n);
    for (auto& w : words) {
        if (!getline(cin, w)) w = "";
        if (!w.empty() && w.back() == '\r') w.pop_back();
    }
    // Brackets make an empty answer visible in the output.
    cout << "[" << solve(words) << "]" << '\n';
    return 0;
}
